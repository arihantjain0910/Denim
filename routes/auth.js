const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const router = express.Router();

// Signup route
router.post('/signup', async (req, res) => {
    try {
        const { employeeCode, employeeName, password } = req.body;
        const existingUser = await User.findUserByUsername(employeeCode, employeeName);

        if (existingUser) {
            req.flash('error_msg', 'Employee code and name already exist');
            return res.redirect('/signup');
        }

        await User.createUser(employeeCode, employeeName, password);
        req.flash('success_msg', 'You are now registered and can log in');
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error signing up');
        res.redirect('/signup');
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { employeeCode, employeeName, password } = req.body;
        console.log(`Login attempt: ${employeeCode}, ${employeeName}`);
        const user = await User.findUserByUsername(employeeCode, employeeName);
        console.log('User found:', user);

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = { id: user.id, employeeCode: user.employeeCode, employeeName: user.employeeName };
            res.redirect('/dashboard');
        } else {
            req.flash('error_msg', 'Invalid credentials');
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error logging in');
        res.redirect('/login');
    }
});

// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Error logging out');
            res.status(500).send('Error logging out');
        } else {
            res.redirect('/login');
        }
    });
});

module.exports = router;
