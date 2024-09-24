class RegistroFungo {
    constructor(id, data, coordenada, autor_id, Taxons_id, observacoes) {
        this.id = id;
        this.data = data;
        this.coordenada = coordenada;
        this.autor_id = autor_id;
        this.Taxons_id = Taxons_id;
        this.observacoes = observacoes; // Adiciona observações ao model
    }

    save(connection, callback) {
        const sql = 'INSERT INTO RegistroFungos (data, coordenada, autor_id, Taxons_id, observacoes) VALUES (?, ?, ?, ?, ?)';
        const values = [this.data, this.coordenada, this.autor_id, this.Taxons_id, this.observacoes];

        connection.query(sql, values, (err, result) => {
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    }
    
    formatData() {
        const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
        return new Date(this.data).toLocaleDateString('pt-BR', options);
    }
    
    static findAll(connection, callback) {
        const sql = 'SELECT * FROM RegistroFungos';
        connection.query(sql, (err, results) => {
            if (err) {
                return callback(err);
            }
            const registros = results.map(row => new RegistroFungo(
                row.id,
                row.data,
                row.coordenada,
                row.autor_id,
                row.Taxons_id
            ));
            callback(null, registros);
        });
    }
}

module.exports = RegistroFungo;
