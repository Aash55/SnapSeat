const { v4: uuidv4 } = require('uuid');

const processPayment = async (amount, simulateFailure = false) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (simulateFailure) {
    return {
      success: false,
      gateway_payment_id: null,
      gateway_event_id: null,
      error: 'Payment declined by gateway',
    };
  }

  const gateway_payment_id = `gw_pay_${uuidv4()}`;
  const gateway_event_id = `gw_evt_${uuidv4()}`;

  return {
    success: true,
    gateway_payment_id,
    gateway_event_id,
    amount,
  };
};

module.exports = { processPayment };
