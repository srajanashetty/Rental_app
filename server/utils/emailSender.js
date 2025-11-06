import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

// ✅ Initialize SendGrid with API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send email using SendGrid API
 */
export const sendEmail = async (to, subject, body) => {
  try {
    const msg = {
      to: to, // ✅ dynamic receiver
      from: process.env.SENDGRID_FROM, // ✅ verified sender only
      subject,
      html: body,
    };

    const response = await sgMail.send(msg);
    console.log("✅ Email sent:", response[0].statusCode);
  } catch (error) {
    console.error(
      "❌ SENDGRID ERROR FULL:",
      JSON.stringify(error.response?.body, null, 2)
    );
    throw error;
  }
};
