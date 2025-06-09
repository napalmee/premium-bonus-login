const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Настройки
const PORT = process.env.PORT || 3000;
const API_URL = 'https://site-v2.apipb.ru';
const API_TOKEN = process.env.API_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const JWT_EXPIRES_IN = '1h';

// Middlewares
app.use(cors({
    origin: 'https://loginpilsner.tilda.ws', // ВАЖНО: сюда твой сайт Тильды
    credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser());

// Middleware для проверки JWT
function authenticate(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Токен недействителен' });
    }
}

// Роуты

// 1️⃣ login-start
app.post('/api/login-start', async (req, res) => {
    const { phone } = req.body;

    try {
        const resp = await axios.post(`${API_URL}/send-register-code`, {
            phone: phone
        }, {
            headers: {
                Authorization: API_TOKEN,
                Accept: 'application/json'
            }
        });

        res.json(resp.data);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка отправки кода' });
    }
});

// 2️⃣ login-verify
app.post('/api/login-verify', async (req, res) => {
    const { phone, code } = req.body;

    try {
        const verifyResp = await axios.post(`${API_URL}/verify-confirmation-code`, {
            phone: phone,
            code: code
        }, {
            headers: {
                Authorization: API_TOKEN,
                Accept: 'application/json'
            }
        });

        if (verifyResp.data.success) {
            const token = jwt.sign(
                { phone: phone },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'None', // для работы с Тильдой ОБЯЗАТЕЛЬНО
                maxAge: 3600000
            });

            res.json({ success: true });

        } else {
            res.json({ success: false, message: 'Неверный код' });
        }

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка подтверждения кода' });
    }
});

// 3️⃣ user-info
app.get('/api/user-info', authenticate, async (req, res) => {
    const phone = req.user.phone;

    try {
        const userInfo = await axios.post(`${API_URL}/buyer-info-detail`,
            { identificator: phone },
            {
                headers: {
                    Authorization: API_TOKEN,
                    Accept: 'application/json'
                }
            });

        res.json(userInfo.data);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка получения данных' });
    }
});

app.post('/api/generate_order_code', authenticate, async (req, res) => {
    const phone = req.user.phone;

    try {
        const qrResp = await axios.post(`${API_URL}/generate-order-code`, {
            phone: phone
        }, {
            headers: {
                Authorization: API_TOKEN,
                Accept: 'application/json'
            }
        });

        res.json(qrResp.data);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка генерации order code' });
    }
});


// 5️⃣ logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'None'
    });
    res.json({ success: true, message: 'Вы вышли из системы' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
