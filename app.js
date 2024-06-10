const express = require("express");
const app = express();
const ejs = require("ejs");
const mysql = require('mysql2');
const path = require("path");
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const session = require('express-session');
const flash = require('connect-flash');
const authRoutes = require('./routes/auth');
const nodemailer = require('nodemailer');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'sangamdenim',
    password: "Sangam@2024"
});
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Sangam@2024',
    database: 'sangamdenim'
};

app.use(session({
    secret: 'mysecretcode',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' // Ensure secure cookies in production
    }
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/auth', authRoutes);

passport.use(new LocalStrategy(
    {
        usernameField: 'employeeName',
        passwordField: 'password',
        passReqToCallback: true
    },
    (req, employeeName, password, done) => {
        const { employeeCode } = req.body;
        connection.query('SELECT * FROM employee WHERE employeeCode = ? AND employeeName = ?', [employeeCode, employeeName], (err, results) => {
            if (err) return done(err);
            if (results.length === 0) return done(null, false, { message: 'Incorrect employee code or name' });

            const user = results[0];
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) return done(err);
                if (isMatch) return done(null, user);
                return done(null, false, { message: 'Incorrect password' });
            });
        });
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    connection.query('SELECT * FROM employee WHERE id = ?', [id], (err, results) => {
        if (err) return done(err);
        done(null, results[0]);
    });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
}

// Routes

app.get('/autocomplete/customerName', isAuthenticated, (req, res) => {
    const query = req.query.q;
    if (query) {
        const sql = 'SELECT DISTINCT customerName FROM customer WHERE customerName LIKE ? LIMIT 10';
        connection.query(sql, [`%${query}%`], (err, results) => {
            if (err) throw err;
            const suggestions = results.map(row => row.customerName);
            res.json(suggestions);
        });
    } else {
        res.json([]);
    }
});


// Endpoint to handle customer name requests
// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Endpoint to handle customer name requests
app.get('/getCustomerName', (req, res) => {
  const customerCode = req.query.code;

  // Query the database for the customer name based on the customer code
  pool.query('SELECT customerName FROM customer WHERE customerCode = ?', [customerCode], (error, results) => {
    if (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ success: false, error: 'Database error' });
    } else {
      if (results.length > 0) {
        const customerName = results[0].customerName;
        res.json({ success: true, customerName: customerName });
      } else {
        res.json({ success: false, error: 'Customer not found' });
      }
    }
  });
});
app.get('/getMaterial', (req, res) => {
    const materialQuery = req.query.material;
  
    // Query the database for the material description based on the material
    pool.query('SELECT material_description FROM enquirys WHERE material = ?', [materialQuery], (error, results) => {
      if (error) {
        console.error('Error querying database:', error);
        res.status(500).json({ success: false, error: 'Database error' });
      } else {
        if (results.length > 0) {
          const materialDescription = results[0].material_description;
          res.json({ success: true, materialDescription: materialDescription });
        } else {
          res.json({ success: false, error: 'Material not found' });
        }
      }
    });
  });
  
app.get('/autocomplete/customerCode', isAuthenticated, (req, res) => {
    const query = req.query.q;
    if (query) {
        const sql = 'SELECT DISTINCT customerCode FROM customer WHERE customerCode LIKE ? LIMIT 10';
        connection.query(sql, [`%${query}%`], (err, results) => {
            if (err) throw err;
            const suggestions = results.map(row => row.customerCode);
            res.json(suggestions);
        });
    } else {
        res.json([]);
    }
});
app.get('/autocomplete/material', isAuthenticated, (req, res) => {
    const query = req.query.q;
    if (query) {
        const sql = 'SELECT DISTINCT material FROM enquirys WHERE material LIKE ? LIMIT 10';
        connection.query(sql, [`%${query}%`], (err, results) => {
            if (err) throw err;
            const suggestions = results.map(row => row.material);
            res.json(suggestions);
        });
    } else {
        res.json([]);
    }
});

app.get('/autocomplete/materialDescription', isAuthenticated, (req, res) => {
    const query = req.query.q;
    if (query) {
        const sql = 'SELECT DISTINCT material_description FROM enquirys WHERE material_description LIKE ? LIMIT 10';
        connection.query(sql, [`%${query}%`], (err, results) => {
            if (err) throw err;
            const suggestions = results.map(row => row.material_description);
            res.json(suggestions);
        });
    } else {
        res.json([]);
    }
});


app.post('/login', passport.authenticate('local', {
    successRedirect: '/sangam/inquiryform',
    failureRedirect: '/login'
}), (req, res) => {
    // This callback will only execute if authentication is successful
    const employeeName = req.body.employeeName;
    req.session.employeeName = employeeName;
    
});

app.post('/register', (req, res) => {
    const { employeeCode, employeeName, password } = req.body;
    const id = uuidv4(); // Generate a unique ID
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) throw err;
        connection.query('INSERT INTO employee (id, employeeCode, employeeName, password) VALUES (?, ?, ?, ?)', [id, employeeCode, employeeName, hash], (err, results) => {
            if (err) throw err;
            res.redirect('/login');
        });
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/logout', isAuthenticated, (req, res) => {
    req.logout(err => {
        if (err) {
            console.error('Error during logout:', err);
            res.redirect('/login');
            return;
        }
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                res.redirect('/login');
                return;
            }
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

// app.get('/sangam', isAuthenticated, (req, res) => {
//     let q = "SELECT count(*) FROM enquiry";
//     try {
//         connection.query(q, (err, result) => {
//             if (err) throw err;
//             console.log(result[0]["count(*)"]);
//             res.send(result[0]);
//         });
//     } catch (err) {
//         console.log(err);
//         res.send("some error in database");
//     }
// });

app.get("/sangam/inquiryform", isAuthenticated, (req, res) => {
    res.render("inquiryform.ejs",{employeeName: req.user.employeeName});
});

// app.get("/sangam/existingnumberform", isAuthenticated, (req, res) => {
//     res.render("existingnumberform.ejs");
// });

app.get('/sangam/newinquiryform', isAuthenticated, (req, res) => {
    const userId = req.user.id;
    const q = "SELECT * FROM enquiry WHERE employee_id = ?";
    connection.query(q, [userId], (err, result) => {
        if (err) throw err;
        res.render("newinquiryform.ejs", { enquirys: result });
    });
});


app.get("/sangam/addnewenquiry", isAuthenticated, (req, res) => {
    res.render("addnewenquiry.ejs",{employeeName: req.user.employeeName});
});

app.post("/sangam/newinquiryform", isAuthenticated, (req, res) => {
    const {customerCode,customerName, material, material_description, quantity, uom, rate, currency, validity_date, remarks,employeeName} = req.body;
    const userId = req.user.id;  // Get the logged-in user's ID

    const q = "INSERT INTO enquiry (customerCode,customerName, material, material_description, quantity, uom, rate, currency, validity_date, remarks, employeeName,employee_id) VALUES (?,?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    connection.query(q, [customerCode,customerName, material, material_description, quantity, uom, rate, currency, validity_date, remarks,employeeName, userId], (err, result) => {
        if (err) throw err;
        req.flash("success", "New material added!");
        res.redirect("/sangam/newinquiryform");
    });
});


const updateStatus = () => {
    const query = `
        UPDATE your_table_name
        SET status = 'CLOSE'
        WHERE status = 'OPEN' AND created_at < NOW() - INTERVAL 72 HOUR;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error updating status:', err);
        } else {
            console.log(`Status updated for ${results.affectedRows} rows`);
        }
    });
};

// Schedule the task to run every hour
cron.schedule('0 * * * *', () => {
    console.log('Running scheduled task to update status');
    updateStatus();
});



const transporter = nodemailer.createTransport({
    host: 'pme.sangamgroup.com',
    port: 26,
    //secure: true, // true for 465, false for other ports
    auth: {
        user: 'testit@sangamgroup.com',
        pass: 'Krishna@123'
    }
});

function fetchTableData(userId, lastSentTimestamp, callback) {
    const connection = mysql.createConnection(dbConfig);

    connection.connect(err => {
        if (err) {
            console.error('Error connecting to MySQL:', err);
            callback(err, null);
            return;
        }

        const query = 'SELECT * FROM enquiry WHERE employee_id = ? AND created_at > ?';
        connection.query(query, [userId, lastSentTimestamp || '1970-01-01 00:00:00'], (err, results) => {
            if (err) {
                console.error('Error fetching user-specific data:', err);
                callback(err, null);
                return;
            }
            
            connection.end();

            callback(null, results);
        });
    });
}

function checkEmailSent(userId, callback) {
    const connection = mysql.createConnection(dbConfig);

    connection.connect(err => {
        if (err) {
            console.error('Error connecting to MySQL:', err);
            callback(err, null);
            return;
        }

        const query = 'SELECT last_sent_at FROM email_logs WHERE user_id = ? ORDER BY last_sent_at DESC LIMIT 1';
        connection.query(query, [userId], (err, results) => {
            if (err) {
                console.error('Error checking email logs:', err);
                callback(err, null);
                return;
            }

            connection.end();

            if (results.length > 0) {
                callback(null, results[0].last_sent_at);
            } else {
                callback(null, null);
            }
        });
    });
}

function generateTable(data) {
    let html = '<table border="1"><tr><th>Customer Code</th><th>Customer Name</th><th>Material</th><th>Material Description</th><th>Quantity</th><th>UOM</th><th>Rate</th><th>Currency</th><th>Validity Date</th><th>Remarks</th><th>Status</th></tr>';
    data.forEach(item => {
        html += `<tr><td>${item.customerCode}</td><td>${item.customerName}</td><td>${item.material}</td><td>${item.material_description}</td><td>${item.quantity}</td><td>${item.uom}</td><td>${item.rate}</td><td>${item.currency}</td><td>${item.validity_date}</td><td>${item.remarks}</td><td>${item.status}</td></tr>`;
    });
    html += '</table>';
    return html;
}

app.post('/submit', (req, res) => {
    const userId = req.user.id;

    checkEmailSent(userId, (err, lastSentTimestamp) => {
        if (err) {
            console.error('Error checking email sent status:', err);
            res.status(500).send('Error checking email sent status');
            return;
        }

        fetchTableData(userId, lastSentTimestamp, (err, tableData) => {
            if (err) {
                console.error('Error fetching table data:', err);
                res.status(500).send('Error fetching data');
                return;
            }

            if (tableData.length === 0) {
                console.log('No new data to send for user:', userId);
                res.redirect("/sangam/newinquiryform");
                return;
            }

            const mailOptions = {
                from: 'testit@sangamgroup.com',
                to: 'denimpd1@sangamgroup.com',
                subject: 'Enquiry Form Data',
                html: generateTable(tableData)
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    
                    console.error('Error sending email:', error);
                    res.status(500).send('Error sending email');
                  
                } else {
                 
                    console.log('Email sent: ' + info.response);
                    
                    updateEmailLogs(userId, (err) => {
                        if (err) {
                            console.error('Error updating email logs:', err);
                        }
                        res.redirect("/sangam/newinquiryform");
                    });
                }
            });
        });
    });
});

function updateEmailLogs(userId, callback) {
    const connection = mysql.createConnection(dbConfig);

    connection.connect(err => {
        if (err) {
            console.error('Error connecting to MySQL:', err);
            callback(err);
            return;
        }

        const query = 'INSERT INTO email_logs (user_id, last_sent_at) VALUES (?, NOW())';
        connection.query(query, [userId], (err) => {
            if (err) {
                console.error('Error updating email logs:', err);
                callback(err);
                return;
            }

            connection.end();

            callback(null);
        });
    });
}

app.listen(8080, () => {
    console.log("Server is listening on port 8080");
});
