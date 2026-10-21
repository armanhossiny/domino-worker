require("dotenv").config();
/*const cluster = require('cluster');
const os = require('os');

const numCPUs = process.env.INSTANCE || 1;  // یا os.cpus().length
const PORT = process.env.PORT || 9093;
if (cluster.isMaster) {
    console.log("Master PID:", process.pid);

    let port = PORT;
    for (let i = 0; i < numCPUs; i++) {

        cluster.fork({ PORT: port });
        console.log(`Worker ${i+1} running on port ${port}`);
        port++;
    }

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);

        const newPort = worker.process.env.PORT;
        cluster.fork({ PORT: newPort });
    });

} else {
    const Worker = require("./src/worker");
}*/

const Worker = require("./src/worker");
