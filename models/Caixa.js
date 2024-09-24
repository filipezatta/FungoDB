// models/Caixas.js
const db = require('../config/db');

const Caixas = {
  getAllCaixas: (callback) => {
    const query = "SELECT * FROM Caixas";
    db.query(query, (err, results) => {
      if (err) {
        return callback(err, null);
      }
      callback(null, results);
    });
  }
};

module.exports = Caixas;
