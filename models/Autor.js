// Model Autor
class Autor {
    constructor(id, nome) {
        this.id = id;
        this.nome = nome;
    }

    save(connection, callback) {
        const sql = 'INSERT INTO Autores (nome) VALUES (?)';
        const values = [this.nome];

        connection.query(sql, values, (err, result) => {
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    }

    static findAll(connection, callback) {
        const sql = 'SELECT * FROM Autores WHERE id != 1;'; // Autor placeholder não aparece
        connection.query(sql, (err, results) => {
            if (err) {
                return callback(err);
            }

            const autores = results.map(row => new Autor(row.id, row.nome));
            callback(null, autores);
        });
    }
}

module.exports = Autor;
