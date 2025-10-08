require('dotenv').config();

const HUGGINGFACE_API_KEY =  process.env.HUGGINGFACE_API_KEY || "";
const PORT = process.env.PORT || 8000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";


module.exports = {
    HUGGINGFACE_API_KEY,
    PORT,
    CORS_ORIGIN,
};