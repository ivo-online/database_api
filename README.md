# The CMD Project Tech Database API
## What does it do?
This API allows you to store and find data in a database, using API calls from your front-end code, without worrying (too much) about what happens in the back-end.
## Installation
1. Clone this repository to a suitable folder on your own computer.
2. In this folder, run `npm install` from the command line to install the neccesary node modules.
3. Rename the file `.env-sample` to `.env` and in this file, add the correct values for DB_HOST, DB_NAME, DB_USERNAME and DB_PASS
4. run `node server.js` from the command line to start the API

You can now make API requests to the server running on `http://localhost:3000/`.
## Data objects
The API allows you to store different types of objects in the database and search for them. It is up to you to determine what kinds of objects you want to use, what the name for each type of object is, and what data is contained in each object. 

For example, one type of object might be a **person**. A **person** might have the following data, specified in JSON:

`{ "name": "John", "age": 28, "nationality": "Dutch" }`

Another **person** could look like this:

`{ "name": "Marie", "age": 42, "nationality": "French" }`

You can use different object types, so for example you could also store information about eggs in an **egg** object type:

`{ "bird": "chicken", "color": "white" , "weight": 60, "edible": true }`

## Requests
You can use a number of different HTTP requests to interact with the data. These are described below. Each HTTP request returns a result as well as a status in JSON format.
### GET
Get requests allow you to retrieve information from the database. You can either list all results for a certain object type, or search for specific instances.

#### list all results
* HTTP request method: GET
* URL: /_objectType_
* Request body: empty
* Returns: all objects of the specified objectType

Example: `GET localhost:3000/person`  
Response:
```json
{
    "records": [
        {
            "_id": "655de960bc9df3867465dd81",
            "objectType": "person",
            "data": {
                "name": "John",
                "age": 28,
                "nationality": "Dutch"
            }
        },
        {
            "_id": "655deea270274f53ebf00c93",
            "objectType": "person",
            "data": {
                "name": "Marie",
                "age": 42,
                "nationality": "French"
            }
        }
    ],
    "statusCode": 0,
    "statusText": "OK"
}
```
#### search by id
* HTTP request method: GET
* URL: /_objectType_?id=_objectID_
* Request body: empty
* Returns: the requested object

Example: `GET localhost:3000/person?id=655de960bc9df3867465dd81`  
Response: 
```json
{
    "records": [
        {
            "_id": "655de960bc9df3867465dd81",
            "objectType": "person",
            "data": {
                "name": "John",
                "age": 28,
                "nationality": "Dutch"
            }
        }
    ],
    "statusCode": 0,
    "statusText": "OK"
}
```
#### search by value
* HTTP request method: GET
* URL: /_objectType_?_key_=_value_
* Request body: empty
* Returns: one or more objects, matching your search criteria

Example: `localhost:3000/person?nationality=French`  
Response:
```json
{
    "records": [
        {
            "_id": "655deea270274f53ebf00c93",
            "objectType": "person",
            "data": {
                "name": "Marie",
                "age": 42,
                "nationality": "French"
            }
        }
    ],
    "statusCode": 0,
    "statusText": "OK"
}
```

Note: you can search for one value at a time. It's not possible to combine multiple search criteria.
### POST
A POST request allows you to store data in the database

* HTTP request method: POST
* URL: /_objectType_
* Request body: contains data for the object in JSON format
* Returns: id of the inserted object

Example: `POST localhost:3000/person`  
Request body: `{ "name": "John", "age": 28, "nationality": "Dutch" }`  
Response: `{
    "_id": "655de960bc9df3867465dd81",
    "statusCode": 0,
    "statusText": "OK"
}`

### PATCH
A PATCH request allows you to update the information for an object that is already in the database. You will need to provide the object id in the query string. You can change the value of existing fields and also add new fields.

* HTTP request method: PATCH
* URL: /_objectType_?id=_objectID_
* Request body: contains new data for the object in JSON format
* Returns: number of modified objects (note that this number can be 0 if the data you provided in the request body was no different from what was already in the database)

Example: `PATCH localhost:3000/person?id=655de960bc9df3867465dd81`  
Request body: `{ "age": 30, "hometown": "Amsterdam" }`  
Response: `{
    "itemsModified": 1,
    "statusCode": 0,
    "statusText": "OK"
}`

### DELETE
A DELETE request allows you to remove an object from the database. You will need to provide the object id in the query string.
* HTTP request method: DELETE
* URL: /_objectType_?id=_objectID_
* Request body: empty
* Returns: number of deleted objects

Example: `DELETE localhost:3000/person?id=655de960bc9df3867465dd81`  
Response: `{
    "itemsDeleted": 1,
    "statusCode": 0,
    "statusText": "OK"
}`
### Maintenance
There are a few special requests you can make to help you out. These all use the HTTP GET method.

Request: `GET localhost:3000/maintenance/status`  
Description: Returns a status code. A quick way to check if the API is running and has a working database connection

Request: `GET localhost:3000/maintenance/cleardatabase`  
Description: Does what it says - permanently removes all data from your database. Good to use when you want to make a fresh start, but handle with care!

Request: `GET localhost:3000/maintenance/generatetestdata`  
Description: Fills your database with some testdata. Any previously existing testdata will be overwritten. The testdata will be of the objectType **test**, so to see the results you can use `GET localhost:3000/test`

## Statuses
Every request returns a statusCode and a descriptive statusText in JSON format. A status code of 0 means the request was succesful, everything else indicates a problem.

0: OK  
1: Database connection failed - doublecheck your .env file to see if you entered all values correctly  
2: No match found in database  
3: Invalid object type - allowed characters are: A-Z, a-z, 0-9, - and _  
4: Please provide a valid id in the querystring, consisting of 24 characters  
5: The API received invalid JSON in the request body. Please [check your JSON](https://jsonlint.com/) syntax  

Example response:
`{
    "statusCode": 0,
    "statusText": "OK"
}`
## License
This project is provided under the [GNU GPLv3](/LICENSE) License.
