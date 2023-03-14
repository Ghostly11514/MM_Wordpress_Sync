const { performance } = require('perf_hooks')
const { MongoClient } = require('mongodb');
const { conn, logger } = require('./functions.js')
const env = require('dotenv').config().parsed

async function dbInit() {
    try {
        var client = await conn()
        var dbList = await client.db().admin().listDatabases()
        var dbCreate = true, collectionNames = ["reliable", "mm_warehouse"]

        for (i = 0; i < dbList.databases.length; i++) {
            if (dbList.databases[i].name == "wordpressSync") {
                dbCreate = false
                var collections = await client.db(dbList.databases[i].name).listCollections({}, { nameOnly: true }).toArray()
                for (j = 0; j < collections.length; j++) {
                    if (collectionNames.indexOf(collections[j].name) > -1) {
                        var index = collectionNames.indexOf(collections[j].name)
                        collectionNames.splice(index, 1)
                    }
                }
                if (collectionNames.length > 0) {
                    dbCreate = true
                }
            }
        }

        if (dbCreate == true) {
            const newDB = client.db("wordpressSync")
            for (i = 0; i < collectionNames.length; i++) {
                await newDB.createCollection(collectionNames[i])
            }
        }

        await logger("\nDatabase initialized...\n")
        client.close()
        return
    } catch (e) {
        console.log(e)
        client.close()
        return
    }
}

async function dbInsert(location, product) {
    try {
        let scriptStart = performance.now()
        var client = await conn()
        var dbClient = client.db(`${env.dbName}`)
        var insertArr = [].concat.apply([], product)

        await dbClient.collection(location).insertMany(insertArr).then(function (response) {
            logger(response.insertedCount + " Products inserted into " + location + " from " + env.wooURL)
        })

        let scriptEnd = performance.now()
        logger("Data stored in the database in: " + ((scriptEnd - scriptStart) / 1000).toFixed(2) + " Seconds")
        client.close()
        return
    } catch (e) {
        console.log(e)
        client.close()
        return
    }
}

async function retrieveProducts(location) {
    var client = await conn()
    var dbClient = client.db(env.dbName)

    try {
        var results = await dbClient.collection(location).find({}).toArray()
        client.close()

        for (i = 0; i < results.length; i++) {
            delete results[i]._id
        }

        return results
    } catch (e) {
        logger(e)
        client.close()
        return
    }
    client.close()
}

module.exports = { dbInit, dbInsert, retrieveProducts }