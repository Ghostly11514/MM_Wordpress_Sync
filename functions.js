const { MongoClient } = require('mongodb')
const WooCommerceAPI = require('woocommerce-api')
const { performance } = require('perf_hooks')
const env = require('dotenv').config().parsed
const fs = require('fs')
const csv = require('csvtojson')
const { resourceLimits } = require('worker_threads')

async function conn() {
    const uri = `mongodb://${env.dbUsername}:${env.dbPassword}@10.0.40.60:27017`;
    const client = new MongoClient(uri);

    try {
        var conn = await client.connect();
        return conn
    } catch (e) {
        console.log(e);
    }
}

async function logger(data) {
    const dateObject = new Date();
    const seconds = dateObject.getSeconds();
    const minutes = dateObject.getMinutes();
    const hours = dateObject.getHours();
    const date = (`0${dateObject.getDate()}`).slice(-2);
    const month = (`0${dateObject.getMonth() + 1}`).slice(-2);
    const year = dateObject.getFullYear();
    const fileName = `wordpressSync_${month}-${date}-${year}.log`

    try {
        if (fs.existsSync("./log/" + fileName)) {
            if (data == "init") {
                fs.appendFileSync("./log/" + fileName, "------------------------------\n", function (error) {
                    if (error) throw error
                })
                fs.appendFileSync("./log/" + fileName, "Wordpress Sync started on: " + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + "\n", function (error) {
                    if (error) throw error
                })
            } else if (data != "end") {
                fs.appendFileSync("./log/" + fileName, data + "\n", function (error) {
                    if (error) throw error
                })
            } else {
                fs.appendFileSync("./log/" + fileName, "Wordpress Sync completed on: " + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), function (error) {
                    if (error) throw error
                })
                fs.appendFileSync("./log/" + fileName, "\n------------------------------\n", function (error) {
                    if (error) throw error
                })
            }
        } else {
            fs.appendFileSync("./log/" + fileName, "", function (error) {
                if (error) throw error
            })
            fs.appendFileSync("./log/" + fileName, "Wordpress Sync API Intergration - " + `${month}-${date}-${year}\n`, function (error) {
                if (error) throw error
            })
            fs.appendFileSync("./log/" + fileName, "\n------------------------------\n", function (error) {
                if (error) throw error
            })
            fs.appendFileSync("./log/" + fileName, "Wordpress Sync started on: " + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + "\n", function (error) {
                if (error) throw error
            })

        }

        return true

    } catch (error) {
        console.error(error)
        return
    }

}

function chunk(arr, chunk) {
    var tempArray = [];
    for (i=0; i < arr.length; i += chunk) {
        tempArray[tempArray.length] = arr.slice(i, i + chunk);
    }
    return tempArray
}

var wooMultiInv = new WooCommerceAPI({
    url: env.wooURL,
    consumerKey: env.wooKey,
    consumerSecret: env.wooSecret,
    wpAPI: true,
    version: "wc/multi-inventory/v1"
})
var wooClientv3 = new WooCommerceAPI({
    url: env.wooURL,
    consumerKey: env.wooKey,
    consumerSecret: env.wooSecret,
    wpAPI: true,
    version: "wc/v3"
})

async function getInventories() {
    try {
        logger("Gathering Inventories...")
        let scriptStart = performance.now()

        var inventories = []

        await wooMultiInv.getAsync('inventories').then(function (response) {
            var resObj = response.toJSON()
            var bodyObj = JSON.parse(resObj.body)

            if (bodyObj.status == true) {
                for (i = 0; i < bodyObj.data.length; i++) {
                    inventories[`${bodyObj.data[i].slug}`] = bodyObj.data[i]
                }
            } else {
                logger("No Inventories Found...")
            }

        }).catch(function (e) {
            logger(e)
            return false
        })

        let scriptEnd = performance.now()
        logger("Inventories gathered in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

        return inventories
    } catch (e) {
        logger(e)
        client.close()
        return
    }
}

async function productExist(sku) {
    try {
        let scriptStart = performance.now()

        var productData = []

        await wooClientv3.getAsync(`products/?sku=${sku}`).then(function (response) {
            var resObj = response.toJSON()
            var bodyObj = JSON.parse(resObj.body)
            productData = bodyObj
        }).catch(function (error) {
            console.log(error)
        })

        if (productData.length > 0) {
            let scriptEnd = performance.now()
            logger("Product found in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

            return true
        } else {
            let scriptEnd = performance.now()
            logger("Unable to find product in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

            return false
        }

    } catch (e) {
        logger(e)
        client.close()
        return
    }


}

async function getProductData(sku) {
    try {
        let scriptStart = performance.now()

        var productData = []

        await wooClientv3.getAsync(`products/?sku=${sku}`).then(function (response) {
            var resObj = response.toJSON()
            var bodyObj = JSON.parse(resObj.body)
            productData = bodyObj
        }).catch(function (error) {
            console.log(error)
        })

        if (productData.length > 0) {
            let scriptEnd = performance.now()
            logger("Product data found in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

            return productData
        } else {
            let scriptEnd = performance.now()
            logger("Unable to find product data in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

            return false
        }

    } catch (e) {
        logger(e)
        client.close()
        return
    }
}

async function getProductQty(sku, inventories) {
    try {
        let scriptStart = performance.now()

        var quantity = []
        var productQty = []
        var invKeys = Object.keys(inventories)

        await wooMultiInv.getAsync(`stock?sku=${sku}`).then(function (response) {
            var resObj = response.toJSON()
            var bodyObj = JSON.parse(resObj.body)
            productQty = bodyObj.data
        }).catch(function (error) {
            console.log(error)
        })

        if (Object.keys(productQty).length > 0) {
            for (i = 0; i < invKeys.length; i++) {
                var amount = productQty[inventories[invKeys[i]].term_id]
                if (amount) {
                    quantity[invKeys[i]] = { quantity: productQty[inventories[invKeys[i]].term_id] }
                }
            }

            let scriptEnd = performance.now()
            logger("Product quantity found in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

            return quantity
        } else {
            let scriptEnd = performance.now()
            logger("Unable to find product quantity in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

            return false
        }

    } catch (e) {
        logger(e)
        client.close()
        return
    }



}

async function createProduct(data) {
    try {
        let scriptStart = performance.now()

        var productID = ""
        const productData = {
            name: data.name,
            type: 'simple',
            status: 'publish',
            featured: false,
            description: data.description,
            short_description: data.short_description,
            sku: data.sku,
            regular_price: data.regular_price,
            manage_stock: true,
            stock_quantity: 0,
            stock_status: 'instock',
            has_options: false,
            meta_data: [
                data.meta_data[0],
            ],
            categories: [
                data.categories,
            ]
        }

        await wooClientv3.postAsync("products", productData).then(function (response) {
            var resObj = response.toJSON()
            var bodyObj = JSON.parse(resObj.body)
            console.log(bodyObj)
            productID = bodyObj.id
        }).catch(function (error) {
            console.log(error)
            return false
        })

        // if (productID) {
        //     let scriptEnd = performance.now()
        //     logger("Product created in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")
        //     return true
        // } else {
        //     let scriptEnd = performance.now()
        //     logger("Unable to create product in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")
        //     return false
        // }

    } catch (e) {
        logger(e)
        return
    }
}

async function updateQty(data) {
    try {
        let scriptStart = performance.now()
        // for (i = 0; i < data.stockLocation.length; i++) {
            var sku = data.sku
            var invID = data.stockLocation[0].location_id
            var qty = data.stockLocation[0].qty

            wooMultiInv.postAsync(`stock?stock=${qty}&sku=${sku}&inventory=${invID}`).catch(function (error) {
                console.log(error)
                return false
            })
        // }

        let scriptEnd = performance.now()
        logger("Product quantity updated in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds\n")

        return true
    } catch (e) {
        logger(e)
        return
    }
    console.log(data.stockLocation.length)

}

async function getCategories() {
    try {
        var categories = {}, maxPage = 0, page = 1

        do {
            await wooClientv3.getAsync(`products/categories?page=${page}`).then(function (response) {
                var resObj = response.toJSON()
                maxPage = resObj.headers['x-wp-totalpages']
                var bodyObj = JSON.parse(resObj.body)

                for (cat = 0; cat < bodyObj.length; cat++) {
                    categories[bodyObj[cat].name] =
                    {
                        id: bodyObj[cat].id,
                        name: bodyObj[cat].name,
                        slug: bodyObj[cat].slug
                    }
                }
    
            }).catch(function (error) {
                console.log(error)
            })

            page++
        } while (page <= maxPage)

        return categories
    } catch {
        logger(e)
        return
    }
}

async function createCategories(data) {
    try {
        var created = {}

        await wooClientv3.postAsync('products/categories', data).then(function (response) {
            var resObj = response.toJSON()
            var bodyObj = JSON.parse(resObj.body)

            created = bodyObj
        }).catch(function (error) {
            console.log(error)
        })

        return created
    } catch (error) {
        logger(error)
        return
    }
}

async function inventoryImport(inventories) {
    // try {
        let scriptStart = performance.now()
        logger("Starting inventory import...\n")
        var invData = await csv().fromFile('./import/inventory.csv'),
        wpCategories = await getCategories(),
        invJson = [],
        createPromises = [], 
        updatePromises = [], 
        categoryPromises = [], 
        categories = []

        logger("Formatting part data...")
        for (i = 0; i < invData.length; i++) {
            if (!invData[i].hasOwnProperty('First')) {
                var temp = invData[i], locations = {}, prodQty = 1
                invData[i]['First'] = true
                locations[`${temp['Location']}`] = 1

                for (j = 0; j < invData.length; j++) {
                    if (temp['Part Number'] == invData[j]['Part Number'] && !invData[j].hasOwnProperty('First')) {
                        if (locations.hasOwnProperty(`${invData[j]['Location']}`)) {
                            locations[`${invData[j]['Location']}`]++
                        } else {
                            locations[`${invData[j]['Location']}`] = 1
                        }

                        if (wpCategories.hasOwnProperty(invData[j].Brand)) {
                            temp.Brand = {
                                id: wpCategories[invData[j].Brand].id,
                                name: wpCategories[invData[j].Brand].name,
                                slug: wpCategories[invData[j].Brand].slug
                            }
                        } else if (invData[j].Brand == "") {
                            temp.Brand = {}
                        } else {
                            categories.push(invData[j].Brand)
                        }

                        invData.splice(j, 1)
                        // j--
                        prodQty++
                    }
                }

                const data = {
                    name: `${temp['Part Number']} - ${temp.Description}`,
                    description: temp.Description,
                    short_description: temp.Description,
                    sku: temp['Part Number'],
                    regular_price: temp.Retail,
                    meta_data: [
                        {
                            key: '_shelf_location',
                            value: JSON.stringify(locations)
                        },
                    ],
                    stockLocation: [
                        {
                            location_id: inventories['mmfact'].term_id,
                            qty: prodQty,
                        }
                    ],
                    categories: temp.Brand
                }

                invJson[i] = data
                console.log(data)
            }
            logger("Part: " + (i + 1) + " data formatted.")
        }
        logger("Part data formatted...\n")

        logger("Creating new Categories...")
        categories = Array.from(new Set(categories))
        for (i = 0; i < categories.length; i++) {
            if (!wpCategories.hasOwnProperty(categories[i])) {
                var category = {
                    name: categories[i]
                }
                categoryPromises.push(createCategories(category))
            }
        }
        await Promise.all(categoryPromises).then(function (result) {
            if (result.id) {
                for (i = 0; i < invJson.length; i++) {
                    if (invJson[i].categories == result.name) {
                        invJson[i].categories = { 
                            id: result.id, 
                            name: result.name, 
                            slug: result.slug 
                        }
                    }
                }
            }
        })
        logger("Categories created...\n")

        logger("Importing parts to Wordpress...")
        // for(i = 0; i < invJson.length; i++){
        //     if(invJson[i] != undefined){
        //         createPromises.push(createProduct(invJson[i]))
        //     }
        // }
        // var createArr = chunk(createPromises, 3)
        // for(i = 0; i < createArr.length; i++){
        //     await Promise.allSettled(createArr[i]).then(async function (result) {
        //         console.log(result)
        //         console.log("Pausing for 2 seconds")
        //         await new Promise(resolve => setTimeout(resolve, 2000));
        //     })
        // }

        // for(i = 0; i < invJson.length; i++){
        //     if(invJson[i] != undefined){
        //         updatePromises.push(updateQty(invJson[i]))
        //     }
        // }
        // var updateArr = chunk(updatePromises, 100)
        // for(i = 0; i < updateArr.length; i++){
        //     await Promise.all(updateArr[i]).then(function (result) {
        //         console.log(result)
        //     })
        // }
        logger("Imported parts to Wordpress...\n")

        let scriptEnd = performance.now()
        logger("Inventory Imported in: " + ((scriptEnd - scriptStart) / 100).toFixed(2) + " Seconds\n")
        return true

    // } catch (error) {
    //     logger("Error: " + error)
    //     return
    // }
}

module.exports = {
    logger,
    conn,
    getInventories,
    getProductQty,
    getProductData,
    productExist,
    createProduct,
    updateQty,
    inventoryImport,
}