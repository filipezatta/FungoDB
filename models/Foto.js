class Foto {
    constructor(id, autor_id, RegistroFungos_id) {
        this.id = id;
        this.autor_id = autor_id;
        this.RegistroFungos_id = RegistroFungos_id;
    }

    save(connection, callback) {
        const sql = 'INSERT INTO Fotos (autor_id, RegistroFungos_id) VALUES (?, ?)';
        const values = [this.autor_id, this.RegistroFungos_id];

        connection.query(sql, values, (err, result) => {
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    }

    static findAll(connection, callback) {
        const sql = 'SELECT * FROM Fotos';
        connection.query(sql, (err, results) => {
            if (err) {
                return callback(err);
            }
            const fotos = results.map(row => new Foto(
                row.id,
                row.autor_id,
                row.RegistroFungos_id
            ));
            callback(null, fotos);
        });
    }
}

module.exports = Foto;
