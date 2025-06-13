const { createApp } = Vue

// constants
const ATLAS_SERVICE ="32150100-9a86-43ac-b15f-200ed1b7a72a";

const app = Vue.createApp({
    data() {
        return {
            // データ
            num_shoots: 0,
            max_sp: 0,
            min_sp: 0,
            avg_sp: 0.0,
            stdev_sp: 0.0,
            hist_num: 0,
            hist_begin: 0,
            hist_end: 60,
            label: ["-"],
            data: [0],
            // Bluetooth
            device: null,
            service: null,
            last_uuid: "",
            last_characteristic: null,
        }
    },
    methods: {
        //---------------------------------------------------------------------
        // データ
        //---------------------------------------------------------------------
        deserialize(header, data1, data2, data3) {
            // ヘッダ情報
            this.num_shoots = header.getUint16(0, true); // ビッグエンディアン
            this.max_sp = header.getUint16(2, true);     // ビッグエンディアン
            this.min_sp = header.getUint16(4, true);     // ビッグエンディアン
            this.avg_sp = header.getUint16(6, true);     // ビッグエンディアン
            this.std_sp = header.getUint16(8, true);     // ビッグエンディアン
            this.hist_begin = header.getUint8(10);
            this.hist_end = header.getUint8(11);

            // ヒストグラムのビン数
            const hist_n_bins = this.hist_end - this.hist_begin + 1;
            // ヒストグラム
            const hists = [data1, data2, data3];
            this.label = new Array(hist_n_bins);
            this.data = new Array(hist_n_bins);

            for (let i = this.hist_begin; i <= this.hist_end; i += 1) {
                const block = Math.floor(i / 20);
                const index = i - (block * 20);
                this.data[i - this.hist_begin] = hists[block].getUint8(index);
                this.label[i - this.hist_begin] = String(4000 + i * 200);
            }
        },
        print_info() {
            console.log(this.num_shoots);
            console.log(this.max_sp);
            console.log(this.min_sp);
            console.log(this.avg_sp);
            for (let i = 0; i < this.data.length; ++i) {
                console.log(this.label[i] + ": " + this.data[i]);
            }
        },
        plot() {
            const ctx = document.getElementById("histogram").getContext('2d');
            const chart = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: this.label,
                    datasets: [{
                        data: this.data,
                        backgroundColor: "#88bbff",
                    }],
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    scales: {
                        x: {
                            title: {
                                display: true,
                                font: {
                                    size: 18
                                },
                                text: "シュート数"
                            }
                        },
                        y: {
                            reverse: true,
                            title: {
                                display: true,
                                font: {
                                    size: 18
                                },
                                text: "シュートパワー"
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            font: {
                                size: 20,
                            },
                            text: "シュートパワー分布"
                        },
                        legend: {
                            display: false
                        },
                    },
                }
            });
        },
        //---------------------------------------------------------------------
        // Bluetooth Low Energy
        //---------------------------------------------------------------------
        async connect() {
            // デバイスが見つかっていなければ
            if (this.device == null) {
                // スキャン実行
                console.log("finding device...");
                this.device = await navigator.bluetooth.requestDevice({
                    filters: [{
                        // サービス名は固定
                        services: [ATLAS_SERVICE],
                    }]
                });
                console.log("finding device...done");
            }
            
            // GATTサービスに接続済みであれば
            if (this.device.gatt.connected && this.service) {
                return;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
            }
            // 接続実行
            console.log("connecting...");
            const server = await this.device.gatt.connect();
            this.service = await server.getPrimaryService(ATLAS_SERVICE);
            console.log("connecting...done");
        },
        async get_characteristic(uuid) {
            console.log('getting characteristic...');
            if (this.last_uuid != uuid) {
                this.last_characteristic = await this.service.getCharacteristic(uuid);
            }
            return this.last_characteristic;
        },
        async read(uuid)
        {
            try {
                await this.connect();
                console.log("reading characteristic...");
                const characteristic = await this.get_characteristic(uuid);
                const data = await characteristic.readValue();
                console.log("reading characteristic...done");
                return data;
            }
            catch (error) {
                console.log("error: " + error);
            }
        },
        async write(uuid, value)
        {
            try {
                await this.connect();
                console.log("writing characteristic...");
                const characteristic = await this.get_characteristic(uuid);
                await characteristic.writeValue(value);
                console.log("writing characteristic...done");
                return;
            }
            catch (error) {
                console.log("error: " + error);
            }
        },
        async disconnect() {
            if (this.device == null) {
                return;
            }
            if (this.device.gatt.connected) {
                console.log("disconnecting...");
                await this.device.gatt.disconnect();
                console.log("disconnecting...done");
            }
            this.device = null;
        },
        //---------------------------------------------------------------------
        // Action
        //---------------------------------------------------------------------
        async read_data() {
            console.log("reading data...1/4");
            const headr = await this.read("32150110-9a86-43ac-b15f-200ed1b7a72a");
            console.log("reading data...2/4");
            const data1 = await this.read("32150101-9a86-43ac-b15f-200ed1b7a72a");
            console.log("reading data...3/4");
            const data2 = await this.read("32150102-9a86-43ac-b15f-200ed1b7a72a");
            console.log("reading data...4/4");
            const data3 = await this.read("32150103-9a86-43ac-b15f-200ed1b7a72a");
            this.deserialize(headr, data1, data2, data3);
            console.log("reading data...done");
            this.plot();
        },
        async clear_data() {
            if (confirm("本体内のデータを初期化しますか？")) {
                console.log("clearing data...");
                await this.write(
                    "32150120-9a86-43ac-b15f-200ed1b7a72a",
                    new Uint8Array([1])
                );
                console.log("clearing data...done");
            }
        }
    }
})
app.mount('#atlas-client');
