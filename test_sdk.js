const { DbConnectionBuilder } = require('spacetimedb');

const builder = new DbConnectionBuilder()
    .withUri('wss://testnet.spacetimedb.com')
    .withDatabaseName('worqs-a8jpe')
    .onConnect((conn, identity, token) => {
        console.log("Connected!", identity, token);
        console.log("Available tables:", Object.keys(conn.db));
        console.log("Available reducers:", Object.keys(conn.reducers));
        conn.disconnect();
    });
const conn = builder.build();
