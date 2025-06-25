const axios = require('axios');

// 📌 MSG91 API config
const MSG91_API_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
const MSG91_AUTH_KEY = '432091A4ewVejNs67bc2e37P1';
const INTEGRATED_NUMBER = '918147845515';
const TEMPLATE_NAME = 'new_lead_25june';
const NAMESPACE = '92a9caec_d4c4_42cb_9e01_58b5495e0ac3';

/**
 * Send WhatsApp template message with 6 placeholders as separate params
 * @param {string} to - recipient phone number with country code
 * @param {string} body1 - placeholder 1
 * @param {string} body2 - placeholder 2
 * @param {string} body3 - placeholder 3
 * @param {string} body4 - placeholder 4
 * @param {string} body5 - placeholder 5
 * @param {string} body6 - placeholder 6
 */
async function sendWhatsAppMsg91(to, body1, body2, body3, body4, body5, body6, body7) {
  try {
    const components = {
      body_1: { type: "text", value: body1 },
      body_2: { type: "text", value: body2 },
      body_3: { type: "text", value: body3 },
      body_4: { type: "text", value: body4 },
      body_5: { type: "text", value: body5 },
      body_6: { type: "text", value: body6 },
      body_7: { type: "text", value: body7 }
    };

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
              components: components
            }
          ]
        }
      }
    };

    console.log('👉 MSG91 WhatsApp Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(MSG91_API_URL, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'authkey': MSG91_AUTH_KEY
      }
    });

    console.log('✅ MSG91 API Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ MSG91 WhatsApp Error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendWhatsAppMsg91 };
