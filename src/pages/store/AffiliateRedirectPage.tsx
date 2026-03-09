import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saveAffiliateCode } from '@/lib/affiliateUtils';
import { supabase } from '@/integrations/supabase/client';

const AffiliateRedirectPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      saveAffiliateCode(code);
      // Increment clicks (fire-and-forget)
      supabase.rpc('increment_affiliate_clicks' as any, { ref_code: code }).then(() => {});
    }
    navigate('/', { replace: true });
  }, [code, navigate]);

  return null;
};

export default AffiliateRedirectPage;
