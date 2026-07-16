process.env.ECHO_RUNTIME = 'web';
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.PORT = process.env.PORT || '4175';

require('../server');
