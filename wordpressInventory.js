const { performance } = require('perf_hooks')
const { getInventories, getProductQty, getProductData, productExist, createProduct, updateQty, inventoryImport, logger } = require('./functions.js')
const { dbInit, retrieveProducts } = require('./dbManage.js')

async function main() {
    let scriptStart = performance.now()
    logger("init")
    await dbInit()

    const inventories = await getInventories()
    // const oldProducts = await retrieveProducts("mm_warehouse")

    await inventoryImport(inventories)

    logger("end")
    let scriptEnd = performance.now()
    logger(`Script took: ${((scriptEnd - scriptStart) / 1000).toFixed(2)} seconds to run.\n`)
    console.log(`Script took: ${((scriptEnd - scriptStart) / 1000).toFixed(2)} seconds to run.`)
    return

}
main()