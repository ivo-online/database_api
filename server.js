require('dotenv').config()
const express = require('express')
const app = express()
const testData = require('./testdata.json')

// interpret all body data in the incoming HTTP request as if it were JSON, 
// regardless of whether the HTTP request header was set correctly as: Content-Type: application/json
app.use(express.json({ type: "*/*" }))

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const uri = 'mongodb+srv://' + process.env.DB_USERNAME + ':' + process.env.DB_PASS + '@' +
  process.env.DB_HOST + '/' + process.env.DB_NAME + '?retryWrites=true&w=majority'

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
})

const statusTexts = [
    "Database connection failed",
    "OK",
    "No match found in database",
    "Invalid object type - allowed characters are: A-Z, a-z, 0-9, - and _",
    "Please provide a valid id in the querystring, consisting of 24 characters"
]

validateParameter = (txt, type) => { 
    switch(type) {
        case "objectType":
            var valid = /^[0-9a-zA-Z_\-]+$/
            break;
        case "id":
            var valid = /^[0-9a-z]{24}$/
            break;
        default:
            return false;
      }

    return valid.test(txt)
}

var dbStatus = false

client.connect()
    .then((res) => {
        console.log('Database connection established')
        dbStatus = true
    })
    .catch((err) => {
        console.log('Database connection error:\n', err, '\nFor uri: ', uri)
    })

app.get('/management/status', (req, res) => {
    res.set('Content-Type', 'application/json')

    if (dbStatus) {
        // we're up and running
        const response = '{' +
            '"statusCode": 1,' +
            '"statusText": "' + statusTexts[1] + '"' +
        '}'
        res.send(response)
    } else {
        // there is no working database connection
        const response = '{' +
            '"statusCode": 0,' +
            '"statusText": "' + statusTexts[0] + '"' +
        '}'
        res.send(response)
    }
})

app.get('/management/generatetestdata', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (dbStatus) {
        const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)

        // check if testdata already exists. If so, delete it and replace with new testdata
        const data = await collection.find({ "objectType": "test" }).toArray()
        
        if (data[0]) {
            collection.deleteMany( { "objectType": "test" } )
        }
        
        for (var i = 0; i < 10; i++) {
            
            var testdata = '{' +
                '"objectType": "test",' +
                '"data": {' +
                    '"name": "' + testData.names[Math.floor(Math.random() * 49)] + '",' +
                    '"age": "' +  Math.floor(Math.random() * 60 + 15) + '",' +
                    '"profession":"' + testData.professions[Math.floor(Math.random() * 49)] + '"' +
                '}' +
            '}'

            collection.insertOne(JSON.parse(testdata))
        }

        const response = '{' +
            '"statusCode": 1,' +
            '"statusText": "' + statusTexts[1] + '"' +
        '}'
        res.send(response)
    } else {
        // there is no working database connection
        const response = '{' +
            '"statusCode": 0,' +
            '"statusText": "' + statusTexts[0] + '"' +
        '}'
        res.send(response)
    }
})

app.get('/management/cleardatabase', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (dbStatus) {
        const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
        collection.deleteMany( {} )

        const response = '{' +
            '"statusCode": 1,' +
            '"statusText": "' + statusTexts[1] + '"' +
        '}'
        res.send(response)
    } else {
        // there is no working database connection
        const response = '{' +
            '"statusCode": 0,' +
            '"statusText": "' + statusTexts[0] + '"' +
        '}'
        res.send(response)
    }
})

app.get('/:objectType', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (validateParameter(req.params.objectType, "objectType")) {

        if (dbStatus) {
            const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
            // if the user requests a specific id in the querystring, see if it is valid
            // if so, try to find this id in the database. If the id is invalid, no data is returned by default
            if (req.query.id ) {
                if ( validateParameter(req.query.id, "id") ) {
                    var id = req.query.id
                    var data = await collection.find({ objectType: req.params.objectType, _id: new ObjectId(id) }).toArray()
                } else {
                    var data = []
                }
                var data = await collection.find({ objectType: req.params.objectType, _id: new ObjectId(id) }).toArray()
            } else {
                // TODO: VALIDATE searchField and searchString
                // if no id was specified, see if there was another search parameter in the querystring. If so, construct a db query to search for requested data
                // if multiple parameters are provided, the first is used and the rest is ignored
                if ( Object.keys(req.query).length ) {
                    const searchField = Object.keys(req.query)[0]
                    const searchString = req.query[searchField ]
                    const dbQuery = JSON.parse('{ "objectType": "' + req.params.objectType + '", "data.' + searchField + '": "' + searchString + '"}')
                    var data = await collection.find(dbQuery).toArray()
                } else {
                    // no search paramaters were specified, so just find all instances of this objectType
                    var data = await collection.find({ objectType: req.params.objectType }).toArray()
                }
            }
                  
            if (data[0]) {
                // send the results back in JSON format
                const response = '{' +
                        '"records":' +  JSON.stringify(data) + ',' +
                        '"statusCode": 1,' +
                        '"statusText": "' + statusTexts[1] + '"' +
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
                    '"statusCode": 0,' +
                    '"statusText": "' + statusTexts[0] + '"' +
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

app.delete('/:objectType', async(req, res) => {
    res.set('Content-Type', 'application/json')

    if (validateParameter(req.params.objectType, "objectType")) {

        if (dbStatus) {
            const collection = client.db(process.env.DB_NAME).collection(process.env.DB_COLLECTION)
            // if the user requests a specific id in the querystring, see if it is valid
            // if so, try to find this id in the database. 
            if (req.query.id && validateParameter(req.query.id, "id") ) {
                var id = req.query.id
                var result = await collection.deleteOne({ objectType: req.params.objectType, _id: new ObjectId(id) })

                if (result["deletedCount"]) {
                    // an item was deleted
                    const response = '{' +
                            '"itemsDeleted":' +  result["deletedCount"] + ',' +
                            '"statusCode": 1,' +
                            '"statusText": "' + statusTexts[1] + '"' +
                        '}'
                    res.send(response)
                } else {
                    // no item was deleted, no match was found for the provided id and objectType
                    const response = '{' +
                            '"records": [],' +
                            '"statusCode": 2,' +
                            '"statusText": "' + statusTexts[2] + '"' +
                        '}'      
                    res.send(response)
                }                
            } else {
                // no id found in querystring or invalid id provided
                const response = '{' +
                '"records": [],' +
                '"statusCode": 4,' +
                '"statusText": "' + statusTexts[4] + '"' +
            '}'
        res.send(response)
            }
        } else {
            // there is no working database connection
            const response = '{' +
                    '"records": [],' +
                    '"statusCode": 0,' +
                    '"statusText": "' + statusTexts[0] + '"' +
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

app.listen(process.env.PORT, () => {
    console.log('Database access API listening on port ' + process.env.PORT)
})

