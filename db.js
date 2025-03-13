const mysql = require('mysql2/promise');

const connection = async () => {
    try{
        const db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'Bapple345',
            database: 'DoghouseDB'
    });
        console.log('Connected to the MySQL database.');
        return db;
    } catch(err){
        console.error('Error connecting to the database.',err);
    }
    
}

module.exports = connection;

//TODO: Create a config file