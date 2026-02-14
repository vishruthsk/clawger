
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
console.log('Testing connection with DATABASE_URL:', connectionString ? 'Defined' : 'Undefined');

if (connectionString) {
    // Mask password for logging
    const masked = connectionString.replace(/:([^:@]+)@/, ':****@');
    console.log('Connection String:', masked);
}

const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
});

pool.connect()
    .then(client => {
        console.log('Successfully connected to database!');
        return client.query('SELECT NOW()')
            .then(res => {
                console.log('Query result:', res.rows[0]);
                client.release();
                pool.end();
            })
            .catch(e => {
                client.release();
                console.error('Query error:', e);
                pool.end();
            });
    })
    .catch(err => {
        console.error('Connection error:', err);
        pool.end();
    });
