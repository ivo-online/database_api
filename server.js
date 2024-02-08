require('dotenv').config()
const express = require('express')
const app = express()

// enable support for Cross-Origin Resource Sharing
const cors = require('cors')
app.use( cors() )

// interpret all body data in the incoming HTTP request as if it were JSON, 
// regardless of whether the HTTP request header was set correctly as: Content-Type: application/json
app.use(express.json({ type: "*/*" }))

const testData = require('./testdata.json')

const statusTexts = [
    "OK",
    "Database connection failed",
    "No match found in database",
    "Invalid object type - allowed characters are: A-Z, a-z, 0-9, - and _",
    "Please provide a valid id in the querystring, consisting of 24 characters",
    "The API received invalid JSON in the request body. Please check your JSON syntax"
]

// function to check if a variable contains valid data
validateParameter = (txt, type) => { 
    let valid

    switch(type) {
        case "objectType":
            // allowed characters for objectType are: A-Z, a-z, 0-9, - and _
            valid = /^[0-9a-zA-Z_\-]+$/
            break;
        case "id":
            // a MongoDB id should have 24 characters (numbers or lowercase letters)
            valid = /^[0-9a-z]{24}$/
            break;
        case "number":
            // a number can only have 0-9
            valid = /^[0-9]+$/
            break;
        default:
            // other types cannot be checked,so just return false
            return false;
      }

    return valid.test(txt)
}

const { MongoClient, ServerApiVersion, ObjectId, CommandStartedEvent } = require('mongodb')

// Construct the URL used to connect to the database from the information in the .env file
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
})

let dbStatus = false

// try to open a database connection
client.connect()
    .then((res) => {
        console.log('Database connection established')
        dbStatus = true
    })
    .catch((err) => {
        console.log(`Database connection error - ${err}`)
        console.log(`For uri - ${uri}`)
    })

// this route responds with a status that indicates if the API has a working database connection
app.get('/maintenance/status', (req, res) => {
    res.set('Content-Type', 'application/json')

    if (dbStatus) {
        // we're up and running
        const response = '{' +
                '"statusCode": 0,' +
                '"statusText": "' + statusTexts[0] + '"' +
            '}'
        res.send(response)
    } else {
        // there is no working database connection
        const response = '{' +
                '"statusCode": 1,' +
                '"statusText": "' + statusTexts[1] + '"' +
            '}'
        res.send(response)
    }
})

// this route fills the database with random test data of objectType test
app.get('/maintenance/generatetestdata', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (dbStatus) {
        const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)

        // check if testdata already exists. If so, delete it and replace with new testdata
        const data = await collection.find({ "objectType": "test" }).toArray()
        
        if (data[0]) {
            collection.deleteMany( { "objectType": "test" } )
        }
        
        for (let i = 0; i < 10; i++) {
            
            let objectData = '{' +
                '"objectType": "test",' +
                '"data": {' +
                    '"name": "' + testData.names[Math.floor(Math.random() * 49)] + '",' +
                    '"age": ' +  Math.floor(Math.random() * 60 + 15) + ',' +
                    '"profession":"' + testData.professions[Math.floor(Math.random() * 49)] + '"' +
                '}' +
            '}'

            collection.insertOne(JSON.parse(objectData))
        }

        const response = '{' +
                '"statusCode": 0,' +
                '"statusText": "' + statusTexts[0] + '"' +
            '}'
        res.send(response)
    } else {
        // there is no working database connection
        const response = '{' +
                '"statusCode": 1,' +
                '"statusText": "' + statusTexts[1] + '"' +
            '}'
        res.send(response)
    }
})

// this route empties the database
app.get('/maintenance/cleardatabase', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (dbStatus) {
        const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
        collection.deleteMany( {} )

        const response = '{' +
                '"statusCode": 0,' +
                '"statusText": "' + statusTexts[0] + '"' +
            '}'
        res.send(response)
    } else {
        // there is no working database connection
        const response = '{' +
                '"statusCode": 1,' +
                '"statusText": "' + statusTexts[1] + '"' +
            '}'
        res.send(response)
    }
})

// this route returns data of the requested objectType from the database. 
// It is possible to search for a specific ID or a certain field in the data by adding a search parameter to the querystring
// If the querystring is empty, all existing objects are returned
app.get('/:objectType', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (validateParameter(req.params.objectType, "objectType")) {
        if (dbStatus) {
            const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
            let data

            // if the user requests a specific id in the querystring, see if it is valid
            // if so, try to find this id in the database. If the id is invalid, no data is returned by default
            if (req.query.id ) {
                if ( validateParameter(req.query.id, "id") ) {
                    let id = req.query.id
                    data = await collection.find({ objectType: req.params.objectType, _id: new ObjectId(id) }).toArray()
                } else {
                    data = []
                }
            } else {
                // if no id was specified, see if there was another search parameter in the querystring. If so, construct a db query to search for requested data
                // if multiple parameters are provided, the first is used and the rest is ignored
                if ( Object.keys(req.query).length ) {
                    // TODO: sanitize searchField and searchString
                    const searchField = Object.keys(req.query)[0]
                    const searchString = req.query[searchField ]
                    let dbQuery
                    
                    if ( validateParameter(searchString, "number") ) {
                        // if the searchString is a number, search for both an integer or a string representing this number
                        dbQuery = JSON.parse('{ "objectType": "' + req.params.objectType + '", "$or": [ {"data.' + searchField + '": "' + searchString + '" } , { "data.' + searchField + '": ' + searchString + '} ] }')
                    } else if (searchString == 'true' || searchString == 'false' || searchString == 'null') {
                        // if the searchString is a literal (true, false or null), search for both the literal or a string representing this number
                        dbQuery = JSON.parse('{ "objectType": "' + req.params.objectType + '", "$or": [ {"data.' + searchField + '": "' + searchString + '" } , { "data.' + searchField + '": ' + searchString + '} ] }')
                    } else {
                        // do a regular text search
                        dbQuery = JSON.parse('{ "objectType": "' + req.params.objectType + '", "data.' + searchField + '": "' + searchString + '"}')
                    }
                    data = await collection.find(dbQuery).toArray()
                } else {
                    // no search paramaters were specified, so just find all instances of this objectType
                    data = await collection.find({ objectType: req.params.objectType }).toArray()
                }
            }
                  
            if (data[0]) {
                // send the results back in JSON format
                const response = '{' +
                        '"records":' +  JSON.stringify(data) + ',' +
                        '"statusCode": 0,' +
                        '"statusText": "' + statusTexts[0] + '"' +
                    '}'
                res.send(response)
            } else {
                // no matching results were found
                const response = '{' +
                        '"records": [],' +
                        '"statusCode": 2,' +
                        '"statusText": "' + statusTexts[2] + '"' +
                    '}'      
                res.send(response)
            }
        } else {
            // there is no working database connection
            const response = '{' +
                    '"records": [],' +
                    '"statusCode": 1,' +
                    '"statusText": "' + statusTexts[1] + '"' +
                '}'
            res.send(response)
        }
    } else {
        // the requested objectType had invalid characters
        const response = '{' +
                '"records": [],' +
                '"statusCode": 3,' +
                '"statusText": "' + statusTexts[3] + '"' +
            '}'
        res.send(response)        
    }
})

// Update a record of the specified objectType with new data. 
// The MongoDB id of the record needs to be specified in the querystring
app.patch('/:objectType', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (validateParameter(req.params.objectType, "objectType")) {

        if (dbStatus) {
            const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
            // The user needs to requests a specific id in the querystring, see if it is valid
            if (req.query.id ) {
                if ( validateParameter(req.query.id, "id") ) {
                    const id = req.query.id

                    let updateFields = '{'
                    let i = 0
                    for(let key in req.body) {
                        if (i != 0) {
                            updateFields += ', '
                        }
                        i++
                        updateFields += '"data.' + key + '": '
                        
                        // if the value is a number or a literal (true, false or null), don't add quotes. For a string, add quotes
                        if ( validateParameter(req.body[key], "number") ) {
                            updateFields += req.body[key]
                        } else if (req.body[key] == true || req.body[key] == false || req.body[key] == null) {
                            updateFields += req.body[key]
                        } else {
                            updateFields += '"' + req.body[key] + '"'
                        }
                     }
                     updateFields += '}'

                    const result = await collection.updateOne({ objectType: req.params.objectType, _id: new ObjectId(id) }, {$set: JSON.parse(updateFields) })

                    if (result.matchedCount) {
                        // send the result back in JSON format
                        const response = '{' +
                                '"itemsModified":' +  result.modifiedCount + ',' +
                                '"statusCode": 0,' +
                                '"statusText": "' + statusTexts[0] + '"' +
                            '}'
                        res.send(response)
                    } else {
                        // no matching results were found
                        const response = '{' +
                                '"itemsModified": 0,' +
                                '"statusCode": 2,' +
                                '"statusText": "' + statusTexts[2] + '"' +
                            '}'      
                        res.send(response)
                    }
                } else {
                    // No id was provided or the id was invalid
                    const response = '{' +
                            '"itemsModified": 0,' +
                            '"statusCode": 4,' +
                            '"statusText": "' + statusTexts[4] + '"' +
                        '}'
                    res.send(response)
                }
            } 
        } else {
            // there is no working database connection
            const response = '{' +
                    '"itemsModified": 0,' +
                    '"statusCode": 1,' +
                    '"statusText": "' + statusTexts[1] + '"' +
                '}'
            res.send(response)
        }
    } else {
        // the requested objectType had invalid characters
        const response = '{' +
                '"itemsModified": 0,' +
                '"statusCode": 3,' +
                '"statusText": "' + statusTexts[3] + '"' +
            '}'
        res.send(response)        
    }
})

// Add a record of the specified objectType with new data. 
// The MongoDB id of the new record is returned
app.post('/:objectType', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (validateParameter(req.params.objectType, "objectType")) {

        if (dbStatus) {
            const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
            const result = await collection.insertOne({ objectType: req.params.objectType, data: req.body })

            const response = '{' +
                    '"_id": "' +  result["insertedId"] + '",' +
                    '"statusCode": 0,' +
                    '"statusText": "' + statusTexts[0] + '"' +
                '}'
                res.send(response)
        } else {
            // there is no working database connection
            const response = '{' +
                    '"_id": null,' +
                    '"statusCode": 1,' +
                    '"statusText": "' + statusTexts[1] + '"' +
                '}'
            res.send(response)
        }
    } else {
        // the requested objectType had invalid characters
        const response = '{' +
                '"_id": null,' +
                '"statusCode": 3,' +
                '"statusText": "' + statusTexts[3] + '"' +
            '}'
        res.send(response)        
    }
})

// Delete a record of the specified objectType with new data. 
// The MongoDB id of the record needs to be specified in the querystring
app.delete('/:objectType', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (validateParameter(req.params.objectType, "objectType")) {

        if (dbStatus) {
            const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
            // if the user requests a specific id in the querystring, see if it is valid
            // if so, try to find this id in the database. 
            if (req.query.id && validateParameter(req.query.id, "id") ) {
                const id = req.query.id
                const result = await collection.deleteOne({ objectType: req.params.objectType, _id: new ObjectId(id) })

                if (result["deletedCount"]) {
                    // an item was deleted
                    const response = '{' +
                            '"itemsDeleted": ' +  result["deletedCount"] + ',' +
                            '"statusCode": 0,' +
                            '"statusText": "' + statusTexts[0] + '"' +
                        '}'
                    res.send(response)
                } else {
                    // no item was deleted, no match was found for the provided id and objectType
                    const response = '{' +
                            '"itemsDeleted": 0,' +
                            '"statusCode": 2,' +
                            '"statusText": "' + statusTexts[2] + '"' +
                        '}'      
                    res.send(response)
                }                
            } else {
                // no id found in querystring or invalid id provided
                const response = '{' +
                        '"itemsDeleted": 0,' +
                        '"statusCode": 4,' +
                        '"statusText": "' + statusTexts[4] + '"' +
                    '}'
                res.send(response)
            }
        } else {
            // there is no working database connection
            const response = '{' +
            '"itemsDeleted": 0,' +
                    '"statusCode": 1,' +
                    '"statusText": "' + statusTexts[1] + '"' +
                '}'
            res.send(response)
        }
    } else {
        // the requested objectType had invalid characters
        const response = '{' +
                '"itemsDeleted": 0,' +
                '"statusCode": 3,' +
                '"statusText": "' + statusTexts[3] + '"' +
            '}'
        res.send(response)        
    }
})

// error handler middleware
app.use((err, req, res, next) => {
    // log the error to the console
    console.error(err.stack)

    if (err.type == 'entity.parse.failed') {
        // if the user send invalid JSON to the API, send back an error message
        res.set('Content-Type', 'application/json')
        const response = '{' +
                '"errorMessage": "' + err.message + '",' +
                '"statusCode": 5,' +
                '"statusText": "' + statusTexts[5] + '"' +
            '}'
        res.send(response)
    } else {
        // something else has gone wrong
        res.status(500).send('Something went horribly wrong on the server!')
    }
})

// start the webserver
app.listen(process.env.PORT, () => {
    console.log(`Project Tech Data API listening on port ${process.env.PORT}`)
})

