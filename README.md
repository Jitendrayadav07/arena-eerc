# Arena EERC Backend

A comprehensive Node.js backend application for managing and monitoring EERC (Encrypted ERC) tokens on the Arena platform. This system integrates with Arena Pro API, manages token data in a MySQL database, and provides automated Twitter posting functionality for new token listings.

## 🚀 Features

- **Token Management**: Automated fetching and storage of Arena Pro tokens
- **EERC Integration**: Support for Encrypted ERC tokens with privacy features
- **Treasury Monitoring**: Real-time tracking of token balances and portfolio values
- **Twitter Automation**: Automated posting of new token listings to Twitter
- **Cron Jobs**: Scheduled tasks for token fetching and social media posting
- **RESTful API**: Clean API endpoints for frontend integration
- **Database Integration**: MySQL database with Sequelize ORM

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL with Sequelize ORM
- **Blockchain**: Ethers.js for Avalanche C-Chain integration
- **Social Media**: Twitter API v2
- **Scheduling**: Node-cron for automated tasks
- **Validation**: Joi for request validation
- **Authentication**: JWT tokens

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL database
- Twitter Developer Account with API access
- Arena Pro API access

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jitendrayadav07/arena-eerc.git
   cd Arena-EERC
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Database Configuration
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASS=your_database_password
   DB_HOST=localhost

   # Twitter API Configuration
   API_KEY=your_twitter_api_key
   API_SECRET=your_twitter_api_secret
   ACCESS_TOKEN=your_twitter_access_token
   ACCESS_SECRET=your_twitter_access_secret
   BEARER_TOKEN=your_twitter_bearer_token

   # Server Configuration
   PORT=8000
   ```

4. **Database Setup**
   - Create a MySQL database
   - The application will automatically create tables using Sequelize migrations

5. **Start the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📚 API Endpoints

### Arena Token Routes (`/v1/arena-token`)

#### Get All EERC Arena Tokens
```http
GET /v1/arena-token/
```
Returns all tokens that are EERC enabled and auditor verified.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "contract_address": "0x...",
      "name": "Token Name",
      "symbol": "SYMBOL",
      "is_eerc": true,
      "is_auditor": true
    }
  ],
  "message": null,
  "status": 200
}
```

#### Get Treasury Tokens
```http
GET /v1/arena-token/treasury-tokens
```
Returns detailed treasury information including token balances, prices, and total portfolio value.

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet_address": "0x94a27A070aE4ed87e5025049a407F8ddf1515886",
    "total_tokens": 5,
    "total_value_usd": "1250.50",
    "holdings": [
      {
        "token_name": "Token Name",
        "token_symbol": "SYMBOL",
        "token_contract_address": "0x...",
        "balance": 1000.5,
        "price": 1.25,
        "value": 1250.625,
        "photo_url": "https://...",
        "pair_address": "0x...",
        "registrationVerifier": "0x...",
        "mintVerifier": "0x...",
        "withdrawVerifier": "0x...",
        "transferVerifier": "0x...",
        "burnVerifier": "0x...",
        "babyJubJub": "0x...",
        "registrar": "0x...",
        "encryptedERC": "0x..."
      }
    ]
  },
  "message": null,
  "status": 200
}
```

### Twitter Routes (`/v1/twitter`)

#### Post Tweet
```http
POST /v1/twitter/tweet
Content-Type: application/json

{
  "message": "Your tweet content here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1234567890",
    "text": "Your tweet content here"
  },
  "message": null,
  "status": 200
}
```

## 🔄 Automated Processes

### Token Fetching Cron Job
- **Schedule**: Every minute (`* * * * *`)
- **Function**: `fetchArenaTokens()`
- **Purpose**: Fetches new tokens from Arena Pro API and stores them in the database
- **Criteria**: Only tokens with balance > 1000 are stored

### Twitter Posting Cron Job
- **Schedule**: Every minute (`* * * * *`)
- **Function**: `tokenTweetTwitter()`
- **Purpose**: Posts new EERC tokens to Twitter automatically
- **Criteria**: Only tokens that are EERC enabled, auditor verified, and not yet tweeted

## 🗄️ Database Schema

### tbl_arena_tokens
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| contract_address | TEXT | Token contract address |
| name | TEXT | Token name |
| symbol | TEXT | Token symbol |
| creator_address | TEXT | Token creator's wallet address |
| pair_address | TEXT | Trading pair address |
| registrationVerifier | TEXT | EERC registration verifier |
| mintVerifier | TEXT | EERC mint verifier |
| withdrawVerifier | TEXT | EERC withdraw verifier |
| transferVerifier | TEXT | EERC transfer verifier |
| burnVerifier | TEXT | EERC burn verifier |
| babyJubJub | TEXT | Baby JubJub curve parameters |
| registrar | TEXT | EERC registrar address |
| encryptedERC | TEXT | Encrypted ERC contract address |
| photo_url | TEXT | Token image URL |
| is_eerc | BOOLEAN | EERC enabled flag |
| is_auditor | BOOLEAN | Auditor verified flag |
| is_tweeted | BOOLEAN | Twitter posted flag |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Record update time |

## 🔐 EERC Features

This system supports Encrypted ERC (EERC) tokens with the following privacy features:

- **Registration Verifier**: Handles token registration with privacy
- **Mint Verifier**: Enables private token minting
- **Withdraw Verifier**: Manages private withdrawals
- **Transfer Verifier**: Handles private transfers
- **Burn Verifier**: Manages private token burning
- **Baby JubJub**: Elliptic curve cryptography for privacy
- **Registrar**: Manages EERC token registry
- **Encrypted ERC**: Core encrypted token contract

## 🌐 External Integrations

### Arena Pro API
- **Base URL**: `https://api.arenapro.io/`
- **Endpoints Used**:
  - `/tokens_view` - Get token information
  - `/token_balances_view` - Get wallet token balances

### Avalanche C-Chain
- **RPC URL**: `https://api.avax.network/ext/bc/C/rpc`
- **Purpose**: Fetching token balances from smart contracts

### Twitter API v2
- **Purpose**: Automated posting of new token listings
- **Features**: Tweet creation with formatted content

## 📁 Project Structure

```
Arena-EERC/
├── classes/
│   └── Response.js          # Standardized API response class
├── config/
│   └── db.config.js         # Database configuration
├── constants/               # Application constants
├── controllers/
│   ├── arenTokenController.js  # Arena token business logic
│   └── twitterController.js    # Twitter integration logic
├── middlewares/
│   ├── joi/                 # Joi validation middleware
│   └── jsonwebtoken/        # JWT authentication middleware
├── models/
│   └── tbl_arena_tokens.js  # Arena token database model
├── routes/
│   ├── arenaTokenRoute.js   # Arena token API routes
│   ├── twitterRoute.js      # Twitter API routes
│   └── index.js             # Route aggregator
├── validations/             # Request validation schemas
├── cron.js                  # Token fetching cron job
├── tokenTweetTwitter.js     # Twitter posting cron job
├── twitterClient.js         # Twitter API client
├── index.js                 # Application entry point
└── package.json             # Dependencies and scripts
```

## 🚀 Scripts

```bash
# Start the application
npm start

# Start in development mode with auto-reload
npm run dev

# Run tests (when implemented)
npm test
```

## 🔧 Configuration

### Database Connection Pool
- **Max Connections**: 10
- **Min Connections**: 0
- **Acquire Timeout**: 30 seconds
- **Idle Timeout**: 10 seconds
- **Connection Timeout**: 20 seconds

### CORS Configuration
- **Origin**: `*` (all origins allowed)
- **Credentials**: Enabled

## 📝 Logging

The application provides comprehensive logging for:
- Database connection status
- Token fetching operations
- Twitter posting results
- Error handling and debugging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions, please open an issue in the repository or contact the development team.

## 🔮 Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Advanced filtering and search capabilities
- [ ] Token analytics and reporting
- [ ] Multi-wallet support
- [ ] Enhanced error handling and monitoring
- [ ] API rate limiting and security improvements
- [ ] Docker containerization
- [ ] Comprehensive test suite
