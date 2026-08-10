/**
 * Test script for verifying Git & Google Apps Script integration.
 */

function runGitTest() {
  const timestamp = new Date().toLocaleString();
  const testMessage = `Git Sync Test executed successfully at: ${timestamp}`;
  
  Logger.log(testMessage);
  
  return testMessage;
}

/**
 * Quick helper function to verify local code updates.
 */
function greetUser(name = "Developer") {
  const greeting = `Hello, ${name}! Your Git integration is working smoothly.`;
  Logger.log(greeting);
  return greeting;
}