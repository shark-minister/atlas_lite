const { createApp } = Vue

// constants
const ATLAS_SERVICE ="32150000-9a86-43ac-b15f-200ed1b7a72a";

class ElectricLauncher {
    constructor() {
        this.enabled_manual = false;
        this.rot_is_right = true;
        this.sp = 10000;
    }
    get_flag() {
        let result = 0;
        if (this.enabled_manual) {
            result |= 1;
        }
        if (!this.rot_is_right) {
            result |= (1 << 4);
        }
        return result;
    }
    set_flag(value) {
        this.enabled_manual = ((value & 1) > 0);
        this.rot_is_right = ((value & 16) == 0);
    }
}

const app = Vue.createApp({
    data() {
        return {
            // パラメータ
            num_motors: 1,
            elr2_auto: false,
            latency: 2000,
            delay: 0,
            elr1: new ElectricLauncher(),
            elr2: new ElectricLauncher(),
            write_rom: false,
            // Bluetooth
            device: null,
            service: null,
            last_uuid: "",
            last_characteristic: null,
            is_gatt_busy: false,
            // データ
            num_shoots: 0,
            min_sp: 0,
            max_sp: 0,
            avg_sp: 0,
            std_sp: 0
        }
    },
    computed: {
        is_button_busy() {
            return this.is_gatt_busy;
        }
    },
    methods: {
        //---------------------------------------------------------------------
        // データ
        //---------------------------------------------------------------------
        serialize() {
            return new Uint8Array([
                this.num_motors-1,
                this.latency / 10,
                this.delay / 2,
                this.elr1.get_flag(),
                this.elr1.sp / 100,
                this.elr2.get_flag(),
                this.elr2.sp / 100
            ]);
        },
        deserialize(data) {
            const first_byte = data.getUint8(0);
            this.num_motors = (first_byte & 16) > 0 ? 2 : 1;
            this.elr2_auto = (first_byte & 1) > 0;
            this.latency = data.getUint8(1) * 10;
            this.delay = data.getUint8(2) * 2;
            this.elr1.set_flag(data.getUint8(3));
            this.elr1.sp = data.getUint8(4) * 100;
            this.elr2.set_flag(data.getUint8(5));
            this.elr2.sp = data.getUint8(6) * 100;    
        },
        //---------------------------------------------------------------------
        // Bluetooth Low Energy
        //---------------------------------------------------------------------
        async connect() {
            // デバイスが見つかっていなければ
            if (this.device == null) {
                // スキャン実行
                console.log("finding device...");
                this.is_gatt_busy = true;
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
            this.is_gatt_busy = true;
            const server = await this.device.gatt.connect();
            this.service = await server.getPrimaryService(ATLAS_SERVICE);
            await this.read_params();
            this.is_gatt_busy = false;
            console.log("connecting...done");
        },
        async get_characteristic(uuid) {
            console.log('getting characteristic...');
            if (this.last_uuid != uuid) {
                this.is_gatt_busy = true;
                this.last_characteristic = await this.service.getCharacteristic(uuid);
                this.is_gatt_busy = false;
            }
            return this.last_characteristic;
        },
        async read(uuid)
        {
            try {
                await this.connect();
                console.log("reading characteristic...");
                this.is_gatt_busy = true;
                const characteristic = await this.get_characteristic(uuid);
                const data = await characteristic.readValue();
                this.is_gatt_busy = false;
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
                this.is_gatt_busy = true;
                const characteristic = await this.get_characteristic(uuid);
                await characteristic.writeValue(value);
                this.is_gatt_busy = false;
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
                this.is_gatt_busy = true;
                await this.device.gatt.disconnect();
                this.is_gatt_busy = false;
                console.log("disconnecting...done");
            }
            this.device = null;
        },
        //---------------------------------------------------------------------
        // Functions
        //---------------------------------------------------------------------
        async read_params() {
            console.log("reading params...");
            const data = await this.read("32150001-9a86-43ac-b15f-200ed1b7a72a");
            this.deserialize(data);
        },
        async write_params() {
            console.log("writing params...");
            // 値が有効な場合のみ
            if (document.getElementById("elr1-sp").checkValidity() &&
                (this.num_motors == 1 || document.getElementById("elr2-sp").checkValidity()) &&
                document.getElementById("delay").checkValidity() &&
                document.getElementById("latency").checkValidity())
            {
                await this.write(
                    "32150001-9a86-43ac-b15f-200ed1b7a72a",
                    this.serialize()
                );
                if (this.write_rom) {
                    // 本体ROMへパラメータを記憶させる
                    await this.store_params();
                }
                return;
            }
            alert("値が適切ではありません");
        },
        async store_params() {
            console.log("storing params in flash memory...");
            await this.write(
                "32150010-9a86-43ac-b15f-200ed1b7a72a",
                new Uint8Array([1])
            );
        },
        async launch() {
            console.log("launching beyblade...");
            await this.write(
                "32150020-9a86-43ac-b15f-200ed1b7a72a",
                new Uint8Array([1])
            );
        },
        async read_shoot_data() {
            console.log("reading shoot data...");
        },
        async clear_shoot_data() {
            console.log("clearing shoot data...");
        }
    }
})
app.mount('#atlas-client');
