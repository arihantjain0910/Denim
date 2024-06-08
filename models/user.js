const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Sangam@2024',
    database: 'sangamdenim'
};

async function findUserByUsername(employeeCode, employeeName) {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM employee WHERE employeeCode = ? AND employeeName = ?', [employeeCode, employeeName]);
    connection.end();
    return rows[0];
}

async function createUser(employeeCode, employeeName, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('INSERT INTO employee (id, employeeCode, employeeName, password) VALUES (UUID(), ?, ?, ?)', [employeeCode, employeeName, hashedPassword]);
    connection.end();
}

module.exports = {
    findUserByUsername,
    createUser
};