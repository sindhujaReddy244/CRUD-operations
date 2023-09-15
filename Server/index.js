require('dotenv').config();
const express = require('express');
const {Client} = require('pg');
const bcrypt = require('bcrypt')
const bodyparser = require('body-parser')
const jwt = require("jsonwebtoken")
const cors = require('cors')


// Creating an Express app.
const app = express();
app.use(cors())
app.use(bodyparser.json())
app.use(bodyparser.urlencoded({extended:true}))

// Connection to the postgresql database.
const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database:process.env.DB_DATABASE,
    password:process.env.DB_PASSWORD,
    port:process.env.DB_PORT,

});

client.connect()
.then(() => {
    console.log('DB Connected')
})
.catch(err => {
    console.log('Error connecting to database', err)
})




app.get('/welcome', (req, res) => {
   
    res.send('Welcome to Node JS')
})


// Register Api
app.post('/register',async(req,res)=>{
    const {email,password}=req.body;  
    const saltrounds = 10
    const hashedPasswd = await bcrypt.hash(password,saltrounds)  
    console.log(hashedPasswd)
    // performing queries using the query() method of the connection object.
    client.query( 'SELECT * FROM users WHERE email = ?',[email],(err,result)=>{
        if(err){
            return res.status(500).json({err})
        }else if(result.length>0){
            return res.status(400).json({message:"Email Already exists. please choose another email"})
        }else{
            // Inserting the user's information into the database.
            client.query(`INSERT into users (email,password) VALUES (?,?)`,
            [email,hashedPasswd],
            (err,result)=>{
                if(err){
                    return res.status(500).json({err})
                }
                return res.status(200).json({message:'User created successfully',data:result})
            })
        }
    })
})



//login API

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('user provided credentials', email, password)

  if (!email || !password) {
    return res.status(400).json({ message: "Enter valid email and password" });
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Enter valid email" });
  }

  try {
    const data = await client.query('SELECT * FROM users WHERE email = $1', [email]);
   // console.log('Data retrieved from database:', data.rowCount);

    if (data.rowCount > 0) {
      const hashedPasswd = data.rows[0].password;
      //console.log('Hashed password retrieved from database:', hashedPasswd);
      //console.log( 'password: ',bcrypt.hashSync(password,10))
      
      const passwordMatch = await bcrypt.compare(password, hashedPasswd);

      if (passwordMatch) {
        //console.log('Password comparison result:', passwordMatch);
        return res.status(200).json({ message: "Logged in successfully" });
      } else {
        //console.log('Password comparison result:', passwordMatch);
        //console.log('Plain Password:', password);
        //console.log('Hashed Password:', hashedPasswd);
        return res.status(400).json({ message: "Enter Correct password" });
      }
    } else {
      console.log('User not found for email:', email);
      return res.status(404).json({ message: "Enter Correct Email" });
    }
  } catch (err) {
    console.log('Error executing query:', err);
    return res.status(500).json({ err });
  }
});




  // student register
app.post('/student/register',async(req,res)=>{
    const {name,contact,email,address}=req.body;

   // check unique phone number

   client.query(`SELECT * FROM table1 where contact = $1`,[contact],(err,data)=>{
    if(err){
        return res.status(500).json({message:"Internal server error in db query"})
    }
    else if (data.length>0){
        return res.status(400).json({message:"Mobile already exists"})
    }else{
    // check unique email 
    client.query(`SELECT * FROM table2 where email = $1`,[email],(err,data)=>{
       //console.log('email data: ' , data)
        if(err){
            return res.status(500).json({message:"Internal server error in db query"})
        }
        else if (data.rows.length>0){
            return res.status(400).json({message:"Email already exists"})
        }else{
          console.log("Data after checking unique email:", data);
            //create user
            client.query(`INSERT INTO table1 (name,contact) VALUES ($1,$2) RETURNING id;`,
                    [name,contact],
                    (err,data)=>{
                       // console.log( 'data: ',data)
                        let tableId  = data.rows[0].id
                        if(err){
                            return res.status(500).json(err)
                        } 
                       // Insert data into table2
                        client.query(`INSERT INTO table2 (email,address,table1_id) VALUES ($1,$2,$3);`,[email,address,tableId],(err,data)=>{
                            if(err){
                                return res.status(500).json(err)
                            }
                            return res.status(200).json(data)
                        })
                    })
                }
            })
        }
    })
})



// Get all students
app.get('/students',(req,res)=>{
    
     client.query(`SELECT * FROM table1 join table2 on table1.id = table2.table1_id`,(err,data)=>{
         if(err){
             return res.status(500).json(err)
         }
         return res.status(200).json(data)
     })
 })


 
 // Get student by id
 app.get('/students/:id',(req,res)=>{
     const {id} =req.params
     client.query(`SELECT * FROM table1 join table2 on table1.id = table2.table1_id WHERE table1.id = $1`,[id],(err,data)=>{
         if(err){
             return res.status(500).json(err)
         }
         return res.status(200).json(data)
     })
 })



 
//update record
app.patch('/students/:id', (req, res) => {
  const { id } = req.params;
  const { name, contact, email, address } = req.body;
 // console.log('Received PATCH request for student with ID:', id);

  // Update in table1
 // console.log('Updating table1...');
  client.query(
      `UPDATE table1
       SET name = $1, contact = $2
       WHERE id = $3`,
      [name, contact, id],
      (err, data) => {
        
          if (err) {
           // console.error('Error updating table1:', err);
              return res.status(500).json(err);
          }
           
          //console.log('Table1 updated successfully.');
          // Update in table2
         // console.log('Updating table2...');
          client.query(
              `UPDATE table2
               SET email = $1, address = $2
               WHERE table1_id = $3`,
              [email, address, id],
              (err, data) => {
                  if (err) {
                      //console.log('table2 error: ', err)
                      //console.error('Error updating table2:', err);
                      return res.status(500).json(err);
                  }
                  //console.log('Table2 updated successfully.');
                  return res.status(200).json(data);
              }
          );
      }
  );
});


 
 //delete record
app.delete('/students/:id', (req, res) => {
  const { id } = req.params;

  // Delete from table2 (child table)
  client.query('DELETE FROM table2 WHERE table1_id = $1', [id], (err, data) => {
      if (err) {
          return res.status(500).json(err);
      }

      // Delete from table1 (parent table)
      client.query('DELETE FROM table1 WHERE id = $1', [id], (err, data) => {
          if (err) {
              return res.status(500).json(err);
          }

          return res.status(200).json({ message: 'Record deleted successfully' });
      });
  });
});




app.listen(4000, () => {
    console.log('Server Running at port 4000')
})