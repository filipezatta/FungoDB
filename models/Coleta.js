// Model Coleta
class Coleta {
    constructor(id, substrato, esporada, textura, autor_id, registroFungos_id, taxons_id, caixas_id) {
        this.id = id;
        this.substrato = substrato;
        this.esporada = esporada;
        this.textura = textura;
        this.autor_id = autor_id;
        this.registroFungos_id = registroFungos_id;
        this.taxons_id = taxons_id;
        this.caixas_id = caixas_id;
    }

    save(connection, callback) {
        const sql = 'INSERT INTO Coletas (substrato, esporada, textura, autor_id, RegistroFungos_id, Taxons_id, Caixas_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
        const values = [this.substrato, this.esporada, this.textura, this.autor_id, this.registroFungos_id, this.taxons_id, this.caixas_id];

        connection.query(sql, values, (err, result) => {
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    }

    static findAll(connection, callback) {
        const sql = 'SELECT * FROM Coletas';
        connection.query(sql, (err, results) => {
            if (err) {
                return callback(err);
            }

            const coletas = results.map(row => new Coleta(row.id, row.substrato, row.esporada, row.textura, row.autor_id, row.RegistroFungos_id, row.Taxons_id, row.Caixas_id));
            callback(null, coletas);
        });
    }
}

module.exports = Coleta;
