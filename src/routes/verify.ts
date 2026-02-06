import { FastifyInstance } from 'fastify';
import { PDFValidator } from '../lib/pdf-validator.js';
import crypto from 'crypto';

export async function verifyRoutes(fastify: FastifyInstance) {
  
  /**
   * POST /api/verify
   * Upload PDF and verify its authenticity
   * This is the ONLY endpoint VeriCert needs
   */
  fastify.post('/verify', async (request, reply) => {
    try {
      // Get uploaded file
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          status: 'ERROR',
          message: 'No file uploaded. Please upload a PDF document.'
        });
      }

      const buffer = await data.toBuffer();
      const filename = data.filename;

      // Step 1: Basic PDF validation
      const validation = await PDFValidator.validate(buffer, filename);
      if (!validation.valid) {
        return reply.code(400).send({
          status: 'INVALID',
          message: validation.error,
          reason: 'File validation failed'
        });
      }

      // Step 2: Security scan
      const securityCheck = await PDFValidator.securityScan(buffer);
      if (!securityCheck.safe) {
        return reply.code(400).send({
          status: 'INVALID',
          message: 'Document contains potentially malicious content',
          threats: securityCheck.threats,
          reason: 'Security check failed'
        });
      }

      // Step 3: Extract metadata
      const metadata = await PDFValidator.extractMetadata(buffer);

      if (!metadata.documentId) {
        return reply.code(200).send({
          status: 'UNKNOWN',
          valid: false,
          message: 'This document does not appear to be an AcadCert credential',
          reason: 'No document ID found in metadata',
          details: {
            isAcadCertDocument: false
          }
        });
      }

      // Step 4: Call AcadCert PUBLIC verification endpoint (no auth needed)
      const acadCertUrl = process.env.ACADCERT_API_URL || 'http://localhost:3000';
      const verifyUrl = `${acadCertUrl}/api/documents/${metadata.documentId}/verify-public`;

      console.log('🔍 Calling AcadCert public verify:', verifyUrl);

      const verifyResponse = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!verifyResponse.ok) {
        console.error('❌ AcadCert API error:', verifyResponse.status);
        
        // Document might not exist
        if (verifyResponse.status === 404) {
          return reply.code(200).send({
            status: 'UNKNOWN',
            valid: false,
            message: 'Document not found in AcadCert system',
            reason: 'Document ID not recognized',
            details: {
              documentId: metadata.documentId
            }
          });
        }

        // Other error
        return reply.code(200).send({
          status: 'UNKNOWN',
          valid: false,
          message: 'Unable to verify document with issuing institution',
          reason: 'Verification service unavailable',
          details: {
            documentId: metadata.documentId,
            httpStatus: verifyResponse.status
          }
        });
      }

      const verificationResult = await verifyResponse.json() as any;
      console.log('✅ AcadCert verification result:', JSON.stringify(verificationResult, null, 2));

      // Step 5: Map AcadCert response to VeriCert format
      return reply.send({
        status: verificationResult.status,
        valid: verificationResult.valid,  // ← FIXED: Added this line!
        message: getStatusMessage(verificationResult),
        documentId: metadata.documentId,
        institutionId: metadata.institutionId,
        institution: verificationResult.institution || {},
        document: verificationResult.document || {},
        verification: {
          cryptographicIntegrity: verificationResult.checks?.signatureValid || false,
          issuingAuthority: verificationResult.checks?.authorityValid || false,
          revocationStatus: verificationResult.checks?.notRevoked || false
        },
        details: mapVerificationDetails(verificationResult),
        verifiedAt: new Date().toISOString(),
        receipt: {
          id: `rcpt_${crypto.randomBytes(12).toString('hex')}`,
          documentId: metadata.documentId,
          verifiedAt: new Date().toISOString(),
          result: verificationResult.valid ? 'VALID' : 'INVALID',
          checks: {
            signature: verificationResult.checks?.signatureValid || false,
            authority: verificationResult.checks?.authorityValid || false,
            revocation: verificationResult.checks?.notRevoked || false
          },
          institution: verificationResult.institution?.name || 'Unknown',
          documentType: verificationResult.document?.type || 'Unknown'
        }
      });

    } catch (error: any) {
      fastify.log.error('Verification error:', error);
      
      // Don't leak internal errors
      return reply.code(500).send({
        status: 'ERROR',
        valid: false,
        message: 'An error occurred during verification. Please try again.',
        reason: 'Internal processing error'
      });
    }
  });
}

/**
 * Get user-friendly status message
 */
function getStatusMessage(result: any): string {
  if (result.status === 'ACTIVE' && result.valid) {
    return 'Valid Document - Issued by institution and currently active';
  }
  
  if (result.status === 'REVOKED') {
    return 'Document Revoked - Issuing institution has invalidated this document';
  }
  
  if (result.status === 'SUPERSEDED') {
    return 'Document Superseded - This document has been replaced by a newer version';
  }
  
  if (!result.valid) {
    if (result.errors && result.errors.length > 0) {
      return `Invalid Document - ${result.errors[0]}`;
    }
    return 'Invalid Document - Document has been tampered with or is not authentic';
  }
  
  return 'Document status could not be determined';
}

/**
 * Map detailed verification information
 */
function mapVerificationDetails(result: any): any {
  const details: any = {
    isValid: result.valid || false
  };

  // Add revocation details if applicable
  if (result.status === 'REVOKED' && result.revokedAt) {
    details.revocation = {
      revokedAt: result.revokedAt,
      revokedBy: result.revokedBy,
      reason: result.reason
    };
  }

  // Add check details
  if (result.checks) {
    details.checks = result.checks;
  }

  // Add error messages if any
  if (result.errors && result.errors.length > 0) {
    details.errors = result.errors;
  }

  return details;
}
