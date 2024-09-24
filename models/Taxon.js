// Model Taxon
class Taxon {
    constructor(id, nome, autor_id, unidadesTaxonomicas_id, taxonanterior_id) {
        this.id = id;
        this.nome = nome;
        this.autor_id = autor_id;
        this.unidadesTaxonomicas_id = unidadesTaxonomicas_id;
        this.taxonanterior_id = taxonanterior_id;
    }

    save(connection, callback) {
        const sql = 'INSERT INTO Taxons (nome, autor_id, unidadesTaxonomicas_id, taxonanterior_id) VALUES (?, ?, ?, ?)';
        const values = [this.nome, this.autor_id, this.unidadesTaxonomicas_id, this.taxonanterior_id];

        connection.query(sql, values, (err, result) => {
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    }

    static findAll(connection, callback) {
        const sql = 'SELECT * FROM Taxons';
        connection.query(sql, (err, results) => {
            if (err) {
                return callback(err);
            }

            const taxons = results.map(row => new Taxon(row.id, row.nome, row.autor_id, row.unidadesTaxonomicas_id, row.taxonanterior_id));
            callback(null, taxons);
        });
    }
}

module.exports = Taxon;
