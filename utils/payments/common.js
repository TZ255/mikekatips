const SNIPPE_NETWORKS = new Set(['halotel', 'vodacom']);

const NETWORK_BY_PREFIX = {
    '60': 'unknown',
    '61': 'halotel',
    '62': 'halotel',
    '63': 'halotel',
    '64': 'unknown',
    '65': 'tigo',
    '66': 'airtel',
    '67': 'tigo',
    '68': 'airtel',
    '69': 'airtel',
    '70': 'tigo',
    '71': 'tigo',
    '72': 'unknown',
    '73': 'ttcl',
    '74': 'vodacom',
    '75': 'vodacom',
    '76': 'vodacom',
    '77': 'tigo',
    '78': 'airtel',
    '79': 'vodacom',
};

function isValidEmail(email = '') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone9 = '') {
    const phoneString = String(phone9).trim();

    if (!/^[67]\d{8}$/.test(phoneString)) {
        return null;
    }

    return `255${phoneString}`;
}

function normalizeName(name) {
    if (!name) return { firstName: 'Customer', lastName: '' };

    const parts = name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;

    return { firstName, lastName };
}

function generateOrderId() {
    return `MTIPS${Date.now().toString(36)}`;
}

function getNetworkBrand(phone = '') {
    const digits = String(phone).replace(/\D/g, '');
    let localPhone = digits;

    if (digits.startsWith('255') && digits.length >= 12) {
        localPhone = digits.slice(3);
    } else if (digits.startsWith('0') && digits.length >= 10) {
        localPhone = digits.slice(1);
    }

    const prefix = localPhone.slice(0, 2);
    return NETWORK_BY_PREFIX[prefix] || 'unknown';
}

function selectPaymentGateway(networkBrand = 'unknown') {
    return SNIPPE_NETWORKS.has(String(networkBrand).toLowerCase()) ? 'snippe' : 'clickpesa';
}

module.exports = {
    generateOrderId,
    getNetworkBrand,
    isValidEmail,
    normalizeName,
    normalizePhone,
    selectPaymentGateway,
};
