export const metadata = {
  title: 'Disclaimer — Real Venture LLC',
}

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000' }}>
      <div
        className="mx-auto px-6 py-16"
        style={{ maxWidth: '720px', lineHeight: '1.75' }}
      >
        <h1
          className="text-3xl font-black mb-10"
          style={{ color: '#E5B547' }}
        >
          Disclaimer
        </h1>

        {/* Website Disclaimer */}
        <h2 className="text-xl font-bold text-white mt-10 mb-3">Website Disclaimer</h2>
        <p className="text-gray-300 mb-4">
          This website uses cookies and similar technologies to help operate, improve,
          promote, and protect our services. By using this website, you acknowledge that you
          have read our Terms of Service and Privacy Policy.
        </p>
        <p className="text-gray-300 mb-6">
          This website is not part of, endorsed by, or affiliated with YouTube, Google,
          Bing, Facebook, Meta, or Microsoft. FACEBOOK is a trademark of Meta Platforms,
          Inc. YOUTUBE is a trademark of Google LLC. BING is a trademark of Microsoft
          Corporation.
        </p>

        {/* Real Estate Education Disclaimer */}
        <h2 className="text-xl font-bold text-white mt-10 mb-3">
          Real Estate Education Disclaimer
        </h2>
        <p className="text-gray-300 mb-4">
          Real Venture LLC is an educational company that provides training, information,
          coaching, and related educational resources regarding real estate investing and
          wholesaling. We do not offer legal, tax, accounting, brokerage, lending, or
          investment advisory services. Nothing on this website, in our content, or in our
          programs should be construed as legal, financial, tax, or investment advice.
        </p>
        <p className="text-gray-300 mb-6">
          Real Venture LLC does not sell a franchise, securities offering, guaranteed income
          system, or get-rich-quick program. We do not promise that participation in any
          training, coaching, or educational program will result in closed deals, profits,
          income, business success, or financial freedom.
        </p>

        {/* Earnings and Results Disclaimer */}
        <h2 className="text-xl font-bold text-white mt-10 mb-3">
          Earnings and Results Disclaimer
        </h2>
        <p className="text-gray-300 mb-4">
          Any statements regarding income, revenue, profits, assignment fees, deals closed,
          timeframes, business growth, or other financial or performance outcomes are
          provided for illustrative and educational purposes only. They should not be
          considered guarantees, representations, or promises of what you may or will
          achieve.
        </p>
        <p className="text-gray-300 mb-4">
          Any testimonials, case studies, student examples, or success stories referenced on
          this website or in our marketing materials reflect the experiences of specific
          individuals. These examples are not necessarily typical, are not intended to
          represent or guarantee that current or future customers will achieve the same or
          similar results, and should not be interpreted as the average or expected
          experience.
        </p>
        <p className="text-gray-300 mb-4">
          Your results will vary and depend on many factors, including but not limited to
          your background, market conditions, effort, consistency, skill, negotiation
          ability, compliance practices, financial position, lead quality, experience, and
          ability to implement what you learn. Real estate investing and wholesaling involve
          risk, and it is possible to spend time and money without achieving any financial
          return.
        </p>
        <p className="text-gray-300 mb-6">
          We make no representation, warranty, or guarantee that you will earn money, close
          deals, replace your income, recover any investment, or achieve any particular
          result from the use of our website, training, coaching, or materials.
        </p>

        {/* Third-Party Content Disclaimer */}
        <h2 className="text-xl font-bold text-white mt-10 mb-3">
          Third-Party Content Disclaimer
        </h2>
        <p className="text-gray-300 mb-4">
          This website and our materials may reference, mention, display, or link to
          third-party platforms, tools, software, services, websites, or content. Unless
          expressly stated otherwise, such references do not constitute endorsements,
          guarantees, or warranties by Real Venture LLC. We are not responsible for the
          accuracy, availability, legality, policies, or performance of any third-party
          content, products, or services.
        </p>
        <p className="text-gray-300 mb-6">
          Any business relationships, affiliations, or shared ownership interests involving
          third parties do not create a guarantee of performance, results, or endorsement
          unless expressly disclosed.
        </p>

        {/* Intellectual Property Notice */}
        <h2 className="text-xl font-bold text-white mt-10 mb-3">
          Intellectual Property Notice
        </h2>
        <p className="text-gray-300 mb-6">
          All content, materials, videos, graphics, text, training resources, and other
          intellectual property made available by Real Venture LLC are owned by or licensed
          to Real Venture LLC and are protected by copyright, trademark, and other
          applicable laws. No part of these materials may be copied, reproduced, republished,
          uploaded, posted, transmitted, distributed, modified, or used to create derivative
          works without prior written permission from Real Venture LLC.
        </p>
      </div>
    </div>
  )
}
