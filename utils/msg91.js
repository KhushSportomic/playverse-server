const axios = require('axios');

const MSG91_API_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
const MSG91_AUTH_KEY = '432091A4ewVejNs67bc2e37P1';
const INTEGRATED_NUMBER = '918147845515';
const TEMPLATE_NAME = 'new_lead_23june';
const NAMESPACE = '92a9caec_d4c4_42cb_9e01_58b5495e0ac3';

async function sendWhatsAppMsg91(to, body1, body2) {
  try {
    const payload = {
      integrated_number: INTEGRATED_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: {
            code: "en",
            policy: "deterministic"
          },
          namespace: NAMESPACE,
          to_and_components: [
            {
              to: [to],
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: body1 },
                    { type: "text", text: body2 }
                  ]
                }
              ]
            }
          ]
        }
      }
    };

    // 👇 Log payload before sending
    console.log('👉 MSG91 WhatsApp Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(MSG91_API_URL, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'authkey': MSG91_AUTH_KEY
      }
    });

    // 👇 Log the API response
    console.log('✅ MSG91 API Response:', response.data);

    return response.data;
  } catch (error) {
    // 👇 Log error properly
    console.error('❌ MSG91 WhatsApp Error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendWhatsAppMsg91 };
