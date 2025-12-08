const express = require("express");
const router = express.Router();
const facilitatorController = require("../controllers/facilitatorController");

/**
 * POST /distributions/run
 * R1: Without X-PAYMENT - Returns 402 Payment Required
 * R2: With X-PAYMENT - Executes payment and processes distribution
 */
router.post("/run", facilitatorController.runDistribution);

/**
 * GET /distributions/status/:batch_id
 * Get distribution status by batch_id
 */
router.get("/status/:batch_id", facilitatorController.getDistributionStatus);

/**
 * POST /private-key
 * Get decrypted private key for entity or sub-entity
 * Requires x-secret-key header for authentication
 */
router.post("/private-key", facilitatorController.getDecryptedPrivateKey);

module.exports = router;
