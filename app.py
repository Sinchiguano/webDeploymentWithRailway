from flask import Flask, render_template, jsonify
import paho.mqtt.client as mqtt
import os
import ssl

from dotenv import load_dotenv
from pathlib import Path




app = Flask(__name__)


# --------------------------------------------------
# MQTT CONFIGURATION
# --------------------------------------------------
# Locate the shared project configuration
# BASE_DIR = Path(__file__).resolve().parents[2]

# load_dotenv(
#     BASE_DIR / ".env",
#     override=True
# )

load_dotenv()



BROKER = os.environ["MQTT_HOST"]
PORT = int(os.environ["MQTT_PORT"])
USERNAME = os.environ["MQTT_USERNAME"]
PASSWORD = os.environ["MQTT_PASSWORD"]




# EMQX CLOUD
# BROKER = "h7437211.ala.us-east-1.emqxsl.com"
# PORT = 8883

# USERNAME = "ubuntu-client"
# PASSWORD = os.environ["MQTT_PASSWORD"]

CA_CERT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "emqxsl-ca.crt"
)


# --------------------------------------------------
# MQTT TOPICS
# --------------------------------------------------

LIGHT1_TOPIC = "home/light1/set"
LIGHT2_TOPIC = "home/light2/set"
LIGHT3_TOPIC = "home/light3/set"
DOOR_TOPIC = "home/door/set"


TOPICS = {
    "light1": LIGHT1_TOPIC,
    "light2": LIGHT2_TOPIC,
    "light3": LIGHT3_TOPIC,
    "door": DOOR_TOPIC,
}


# --------------------------------------------------
# CURRENT DEVICE STATES
# --------------------------------------------------

device_states = {
    "light1": "OFF",
    "light2": "OFF",
    "light3": "OFF",
    "door": "OFF",
}


# --------------------------------------------------
# MQTT CALLBACKS
# --------------------------------------------------

def on_connect(
    client,
    userdata,
    flags,
    reason_code,
    properties
):

    if reason_code.is_failure:
        print(f"Connection failed: {reason_code}")
        return

    print("Connected successfully to EMQX Cloud!")

    for device, topic in TOPICS.items():
        result, mid = client.subscribe(topic, qos=1)

        if result == mqtt.MQTT_ERR_SUCCESS:
            print(f"Subscription requested: {topic}")
        else:
            print(f"Subscription error: {topic} -> {result}")


def on_disconnect(
    client,
    userdata,
    disconnect_flags,
    reason_code,
    properties
):

    print(f"Disconnected from EMQX Cloud: {reason_code}")


def on_message(
    client,
    userdata,
    message
):

    payload = (
        message.payload
        .decode()
        .strip()
        .upper()
    )

    print(f"MQTT received: {message.topic} -> {payload}")

    if payload not in ["ON", "OFF"]:
        return

    for device, topic in TOPICS.items():
        if message.topic == topic:
            device_states[device] = payload
            print(f"{device} state: {payload}")
            break


# --------------------------------------------------
# MQTT CLIENT
# --------------------------------------------------

mqtt_client = mqtt.Client(
    mqtt.CallbackAPIVersion.VERSION2
)

mqtt_client.username_pw_set(
    USERNAME,
    PASSWORD
)

mqtt_client.tls_set(
    ca_certs=CA_CERT,
    cert_reqs=ssl.CERT_REQUIRED,
    tls_version=ssl.PROTOCOL_TLS_CLIENT
)

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.on_disconnect = on_disconnect

print("Connecting to EMQX Cloud...")

mqtt_client.connect(
    BROKER,
    PORT,
    60
)

mqtt_client.loop_start()


# --------------------------------------------------
# WEB PAGES
# --------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/devices")
def devices():
    return render_template("devices.html")


# ==================================================
# LIGHT 1
# ==================================================

@app.route("/light1/on")
def light1_on():
    mqtt_client.publish(LIGHT1_TOPIC, "ON", qos=1)
    return jsonify({"device": "light1", "state": "ON"})


@app.route("/light1/off")
def light1_off():
    mqtt_client.publish(LIGHT1_TOPIC, "OFF", qos=1)
    return jsonify({"device": "light1", "state": "OFF"})


@app.route("/light1/state")
def light1_state():
    return jsonify({
        "device": "light1",
        "state": device_states["light1"]
    })


# ==================================================
# LIGHT 2
# ==================================================

@app.route("/light2/on")
def light2_on():
    mqtt_client.publish(LIGHT2_TOPIC, "ON", qos=1)
    return jsonify({"device": "light2", "state": "ON"})


@app.route("/light2/off")
def light2_off():
    mqtt_client.publish(LIGHT2_TOPIC, "OFF", qos=1)
    return jsonify({"device": "light2", "state": "OFF"})


@app.route("/light2/state")
def light2_state():
    return jsonify({
        "device": "light2",
        "state": device_states["light2"]
    })


# ==================================================
# LIGHT 3
# ==================================================

@app.route("/light3/on")
def light3_on():
    mqtt_client.publish(LIGHT3_TOPIC, "ON", qos=1)
    return jsonify({"device": "light3", "state": "ON"})


@app.route("/light3/off")
def light3_off():
    mqtt_client.publish(LIGHT3_TOPIC, "OFF", qos=1)
    return jsonify({"device": "light3", "state": "OFF"})


@app.route("/light3/state")
def light3_state():
    return jsonify({
        "device": "light3",
        "state": device_states["light3"]
    })


# ==================================================
# DOOR
# ==================================================

@app.route("/door/open")
def door_open():
    mqtt_client.publish(DOOR_TOPIC, "ON", qos=1)
    return jsonify({"device": "door", "state": "OPEN"})


@app.route("/door/close")
def door_close():
    mqtt_client.publish(DOOR_TOPIC, "OFF", qos=1)
    return jsonify({"device": "door", "state": "CLOSED"})


@app.route("/door/state")
def door_state():
    mqtt_state = device_states["door"]
    display_state = "OPEN" if mqtt_state == "ON" else "CLOSED"

    return jsonify({
        "device": "door",
        "state": display_state,
        "mqtt_state": mqtt_state
    })


# ==================================================
# ALL DEVICE STATES
# ==================================================

@app.route("/devices/state")
def all_device_states():
    return jsonify({
        "light1": {
            "name": "Living Room Light",
            "state": device_states["light1"]
        },
        "light2": {
            "name": "Laboratory Light",
            "state": device_states["light2"]
        },
        "light3": {
            "name": "Entrance Light",
            "state": device_states["light3"]
        },
        "door": {
            "name": "Main Door",
            "state": "OPEN" if device_states["door"] == "ON" else "CLOSED"
        }
    })


# --------------------------------------------------
# START SERVER
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=False
    )
