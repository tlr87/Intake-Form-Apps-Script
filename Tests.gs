/**
 * RD3 Tech Lead Engine - Debugging & Test Functions
 */
function testLeadPipeline() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        name: "Test Customer",
        email: "test@example.com",
        phone: "021 555 1234",
        message: "Hi Tom, my TV screen is broken and needs panel replacement ASAP.",
        honeypot: ""
      })
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log("Test Result Output: " + result.getContent());
}

function testSpamDetection() {
  const mockSpam = {
    postData: {
      contents: JSON.stringify({
        name: "Spam Bot",
        email: "spam@bot.com",
        message: "Check out our cheap crypto and SEO ranking services at http://spam.com",
        honeypot: "gotcha"
      })
    }
  };
  
  const result = doPost(mockSpam);
  Logger.log("Spam Test Result Output: " + result.getContent());
}