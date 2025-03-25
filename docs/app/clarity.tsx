import Script from 'next/script';
import { FC } from 'react';

const ClarityScript: FC = () => {
  return (
    <Script id="clarity-script" strategy="afterInteractive">
      {`
                (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "qto3l16r3t");
            `}
    </Script>
  );
};

export default ClarityScript;
