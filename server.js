require('dotenv').config();
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// Вставь сюда URL своего фронтенда, например: 'https://your-frontend-domain.com' или 'http://localhost:3000'
const FRONTEND_URL = 'https://loginpilsner.tilda.ws';

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true // чтобы JWT cookie передавалась
}));

res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 3600000
});


const API_URL = process.env.API_URL;
const API_TOKEN = process.env.API_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const PORT = process.env.PORT || 3000;

const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Недействительный токен' });
    }
};

app.post('/api/login-start', async (req, res) => {
    const { phone } = req.body;
    try {
        const buyerInfo = await axios.post(`${API_URL}/buyer-info`,
            { identificator: phone },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        const data = buyerInfo.data;

        if (data.blocked) {
            return res.status(403).json({ success: false, message: 'Пользователь заблокирован' });
        }

        if (!data.is_registered) {
            return res.status(404).json({ success: false, message: 'Пользователь не зарегистрирован' });
        }

        await axios.post(`${API_URL}/send-register-code`,
            { phone: phone },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        res.json({ success: true, message: 'Код отправлен' });

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/api/login-verify', async (req, res) => {
    const { phone, code } = req.body;

    try {
        const verifyResp = await axios.post(`${API_URL}/verify-confirmation-code`,
            { phone: phone, code: code },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        if (verifyResp.data.success) {
            const token = jwt.sign(
                { phone: phone },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                maxAge: 3600000
            });

            res.json({ success: true, message: 'Вход выполнен' });
        } else {
            res.status(401).json({ success: false, message: 'Неверный код' });
        }

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка проверки кода' });
    }
});

app.get('/api/user-info', authenticate, async (req, res) => {
    const phone = req.user.phone; // Берем phone из JWT

    try {
        const userInfo = await axios.post(`${API_URL}/buyer-info-detail`,
            { identificator: phone },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        res.json(userInfo.data);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка получения данных' });
    }
});

app.post('/api/qr-generate', authenticate, async (req, res) => {
    const phone = req.user.phone; // Берем phone из JWT

    try {
        const qrResp = await axios.post(`${API_URL}/qr-generate`,
            { phone: phone, ttl: 120 },
            { headers: { Authorization: API_TOKEN, Accept: 'application/json' } }
        );

        res.json(qrResp.data);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ success: false, message: 'Ошибка генерации QR' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
    });
    res.json({ success: true, message: 'Вы вышли из системы' });
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

