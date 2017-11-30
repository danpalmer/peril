import * as child_process from "child_process"

import jsonDatabase from "../db/json"
import { DATABASE_JSON_FILE } from "../globals"

const log = console.log

const go = async () => {
  // Download settings
  const db = jsonDatabase(DATABASE_JSON_FILE)
  await db.setup()

  const installation = await db.getInstallation(0)
  if (!installation) {
    return
  }
  // Look for plugins
  if (installation.settings.modules && installation.settings.modules.length !== 0) {
    const modules = installation.settings.modules
    log("Installing: " + modules.join(", "))

    await execPromise("yarn", ["add", ...modules, "--ignore-scripts"], {
      env: { ...process.env, NO_RECURSE: "YES" },
    }).catch(code => {
      process.exit(code)
    })

    await Promise.all(
      modules
        .map(module => {
          const metadata = require(`${module}/package.json`)
          const postInstall = metadata.scripts["peril:postinstall"]
          return { module, postInstall }
        })
        .filter(val => val.postInstall)
        .map(val => {
          log(`Running peril:postinstall for ${val.module}`)
          return execPromise("yarn", ["run", `--cwd=node_modules/${val.module}`, "peril:postinstall"])
        })
    )
      .catch(process.exit)
      .then(code => {
        log(`Finished post install hooks`)
        process.exit(0)
      })
  } else {
    log("Not adding any plugins")
    process.exit(0)
  }
}

const execPromise = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(command, args, options)

    child.stdout.on("data", data => log(`-> : ${data}`))
    child.stderr.on("data", data => log(`! -> : ${data}`))

    child.on("close", code => {
      log(`${command} process exited with code ${code}`)
      if (code !== 0) {
        reject(code)
      } else {
        resolve(code)
      }
    })
  })
}

go()
