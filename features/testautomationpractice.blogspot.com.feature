Feature: Basic Playwright Practice

  Scenario: Open the Test Automation Practice website
    Given I navigate to "https://testautomationpractice.blogspot.com/"
    Then The page title should be "Automation Testing Practice"
    