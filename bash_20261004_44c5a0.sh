# Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"03001234567","password":"secret123","name":"Ali"}'

# Login (returns token)
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"03001234567","password":"secret123"}'

# Get balance
curl http://localhost:5000/api/v1/wallet/balance \
  -H "Authorization: Bearer <TOKEN>"

# Deposit request
curl -X POST http://localhost:5000/api/v1/payments/deposit-request \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"amount":1000,"paymentMethod":"easypaisa","trxId":"TRX123456","screenshotUrl":"https://example.com/p.png"}'

# Admin: approve deposit (must be logged in as admin)
curl -X POST http://localhost:5000/api/v1/admin/payments/<requestId>/approve \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{"adminNote":"Verified"}'