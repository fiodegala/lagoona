import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saveAffiliateCode } from '@/lib/affiliateUtils';
import { supabase } from '@/integrations/supabase/client';

const AffiliateRedirectPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const processRedirect = async () => {
      if (code) {
        // Save affiliate code to localStorage (persists 30 days)
        saveAffiliateCode(code);
        
        // Increment clicks counter
        try {
          await supabase.rpc('increment_affiliate_clicks' as any, { ref_code: code });
        } catch (err) {
          console.error('Error incrementing affiliate clicks:', err);
        }
      }
      // Redirect to homepage
      navigate('/', { replace: true });
    };

    processRedirect();
  }, [code, navigate]);

  return null;
};

export default AffiliateRedirectPage;
