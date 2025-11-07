import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VerificationResponse {
  success: boolean;
  message: string;
  email?: string;
}

const EmailVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resending'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');
  const [email, setEmail] = useState<string>('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    verifyEmail(token);
  }, [token]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(`/api/auth/verify-email?token=${verificationToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: VerificationResponse = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message);
        if (data.email) {
          setEmail(data.email);
        }
        
        // Show success toast
        toast.success('Email verified successfully!', {
          description: 'You can now sign in to your account.',
        });

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.message || 'Verification failed. Please try again.');
        
        // Show error toast
        toast.error('Email verification failed', {
          description: data.message || 'Please try again or request a new verification email.',
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('An error occurred during verification. Please try again later.');
      
      toast.error('Verification failed', {
        description: 'An unexpected error occurred. Please try again later.',
      });
    }
  };

  const resendVerificationEmail = async () => {
    if (!email) {
      toast.error('Email not found', {
        description: 'Please enter your email address to resend the verification email.',
      });
      return;
    }

    setStatus('resending');
    setMessage('Sending verification email...');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Verification email sent!', {
          description: 'Please check your email for the verification link.',
        });
        setStatus('error'); // Stay on error state but allow resend
        setMessage('Verification email sent! Please check your inbox.');
        setCanResend(false);
        setCountdown(60); // 60 second cooldown
      } else {
        toast.error('Failed to send email', {
          description: data.message || 'Please try again later.',
        });
        setStatus('error');
        setMessage(data.message || 'Failed to send verification email.');
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast.error('Failed to send email', {
        description: 'An unexpected error occurred. Please try again later.',
      });
      setStatus('error');
      setMessage('An error occurred while sending the email.');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
      case 'resending':
        return <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'error':
        return <XCircle className="w-16 h-16 text-red-500" />;
      default:
        return <AlertCircle className="w-16 h-16 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getButtonState = () => {
    if (status === 'resending') {
      return { disabled: true, text: 'Sending...', loading: true };
    }
    if (!canResend) {
      return { disabled: true, text: `Wait ${countdown}s to resend`, loading: false };
    }
    return { disabled: false, text: 'Resend Verification Email', loading: false };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Mail className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Email Verification
          </h2>
        </div>

        <div className={`rounded-lg border-2 p-8 text-center ${getStatusColor()}`}>
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {status === 'success' ? 'Email Verified!' : 
             status === 'error' ? 'Verification Failed' : 
             status === 'resending' ? 'Sending Email...' :
             'Verifying Email...'}
          </h3>
          
          <p className="text-gray-600 mb-6">
            {message}
          </p>

          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-left">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <button
                onClick={resendVerificationEmail}
                disabled={getButtonState().disabled}
                className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  getButtonState().disabled
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
              >
                {getButtonState().loading && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  </>
                )}
                {getButtonState().text}
              </button>
              
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Login
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="text-sm text-gray-500">
              Redirecting to login page in a moment...
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <a
              href="mailto:support@your-domain.com"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;