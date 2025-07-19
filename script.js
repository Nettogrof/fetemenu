document.addEventListener('DOMContentLoaded', () => {
    const drinksUl = document.getElementById('drinks-ul');
    const orderButton = document.getElementById('order-button');
    const orderStatus = document.getElementById('order-status');

    let selectedDrink = null;

    // --- MQTT Configuration ---
    // IMPORTANT: Replace with your actual MQTT broker details
    const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt'; // Example: using HiveMQ's public broker over WebSockets (WSS)
    const MQTT_TOPIC = 'github/static/drink_orders'; // Your desired MQTT topic

    // Create an MQTT client instance
    const client = mqtt.connect(MQTT_BROKER_URL);

    client.on('connect', () => {
        console.log('Connected to MQTT broker!');
        orderStatus.textContent = 'Ready to take orders!';
        orderStatus.classList.remove('error');
        orderStatus.style.color = '#4CAF50'; // Green for connected
    });

    client.on('error', (err) => {
        console.error('MQTT connection error:', err);
        orderStatus.textContent = 'Error connecting to MQTT broker. Check console for details.';
        orderStatus.classList.add('error');
        orderStatus.style.color = '#f44336'; // Red for error
        orderButton.disabled = true;
    });

    client.on('close', () => {
        console.log('Disconnected from MQTT broker.');
        orderStatus.textContent = 'Disconnected from MQTT broker. Attempting to reconnect...';
        orderStatus.classList.add('error');
        orderStatus.style.color = '#f44336'; // Red for disconnected
        orderButton.disabled = true;
    });

    // --- Load Drinks from CSV ---
    async function loadDrinks() {
        try {
            const response = await fetch('drinks.csv');
            const csvText = await response.text();
            const drinks = parseCSV(csvText);
            displayDrinks(drinks);
        } catch (error) {
            console.error('Error loading or parsing CSV:', error);
            drinksUl.innerHTML = '<li>Error loading drink menu.</li>';
            orderButton.disabled = true;
        }
    }

    // Simple CSV parser (assumes comma as delimiter and first row as header)
    function parseCSV(csvString) {
        const lines = csvString.trim().split('\n');
        const headers = lines[0].split(',');
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length === headers.length) {
                const item = {};
                for (let j = 0; j < headers.length; j++) {
                    item[headers[j].trim()] = values[j].trim();
                }
                data.push(item);
            }
        }
        return data;
    }

    function displayDrinks(drinks) {
        drinksUl.innerHTML = ''; // Clear previous list
        drinks.forEach(drink => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="drink-name">${drink.name}</span>
                <span class="drink-image">${drink.image}</span>
            `;
            li.dataset.name = drink.name; // Store drink name for easy access
            li.dataset.image = drink.image; // Store price as well

            li.addEventListener('click', () => {
                // Remove 'selected' class from all items
                document.querySelectorAll('#drinks-ul li').forEach(item => {
                    item.classList.remove('selected');
                });
                // Add 'selected' class to the clicked item
                li.classList.add('selected');
                selectedDrink = drink;
                orderButton.disabled = false;
                orderStatus.textContent = `Selected: ${selectedDrink.name} - $${parseFloat(selectedDrink.price).toFixed(2)}`;
                orderStatus.classList.remove('error');
                orderStatus.style.color = '#333'; // Reset to default text color
            });
            drinksUl.appendChild(li);
        });
    }

    // --- Order Button Click Handler ---
    orderButton.addEventListener('click', () => {
        if (selectedDrink && client.connected) {
            const message = JSON.stringify({
                drink: selectedDrink.name,
                name: document.getElementById('nomPersonne'),
                timestamp: new Date().toISOString()
            });

            client.publish(MQTT_TOPIC, message, (err) => {
                if (err) {
                    console.error('Failed to publish MQTT message:', err);
                    orderStatus.textContent = 'Order failed! (MQTT error)';
                    orderStatus.classList.add('error');
                    orderStatus.style.color = '#f44336';
                } else {
                    console.log('MQTT message published:', message);
                    orderStatus.textContent = `Order for "${selectedDrink.name}" placed successfully!`;
                    orderStatus.classList.remove('error');
                    orderStatus.style.color = '#4CAF50';
                    // Optional: Deselect drink after ordering
                    document.querySelectorAll('#drinks-ul li').forEach(item => {
                        item.classList.remove('selected');
                    });
                    selectedDrink = null;
                    orderButton.disabled = true;
                }
            });
        } else if (!client.connected) {
            orderStatus.textContent = 'Cannot order: Not connected to MQTT broker.';
            orderStatus.classList.add('error');
            orderStatus.style.color = '#f44336';
        } else {
            orderStatus.textContent = 'Please select a drink first.';
            orderStatus.classList.remove('error');
            orderStatus.style.color = '#333';
        }
    });

    // Initial load of drinks when the page loads
    loadDrinks();
});
