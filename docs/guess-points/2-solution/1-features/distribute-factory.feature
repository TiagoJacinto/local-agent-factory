Feature: Distribute and operate the Local Agent Factory
  A Factory Operator can install the Bun-based factory, run its capabilities, install approved skills, and configure behavior by scope.

  Scenario: Initialize local factory configuration without installing runtime files
    Given the Local Agent Factory CLI is installed
    And the Factory Operator is in a target repository
    When the Factory Operator runs "laf init"
    Then a local factory configuration file is created
    And no factory runtime files are installed

  Scenario: Initialize global factory configuration
    Given the Local Agent Factory CLI is installed
    When the Factory Operator runs "laf init --global"
    Then a global factory configuration file is created

  Scenario: Install the global CLI with Bun
    Given Bun is installed
    When the Factory Operator runs "bun add --global local-agent-factory"
    Then the "laf" command is available
    And "laf --version" reports the installed package version
    And Node and npm are not required

  Scenario: Install the factory into a repository without npm
    Given Bun, curl, and tar are installed
    And the Factory Operator is in a target repository
    When the Factory Operator runs the one-command installer
    Then the installer downloads the latest GitHub Release archive
    And the installer verifies the archive checksum
    And the factory is installed into the target repository
    And npm is not invoked

  Scenario: Run packaged workflows and applications
    Given the Local Agent Factory CLI is installed
    And the Factory Operator is in an installed target repository
    When the Factory Operator uses the available capabilities
      | command                          | outcome                           |
      | laf workflow list                | registered workflows are listed   |
      | laf workflow run prompt "Say hi" | the prompt workflow is executed    |
      | laf app run visualizer           | the packaged visualizer is started |
    Then each capability runs through Bun
    And source files from the factory checkout are not required

  Scenario: Install an approved mock skill
    Given the Local Agent Factory CLI is installed
    When the Factory Operator runs "laf skill list"
    Then only these installable skills are listed
      | skill           |
      | mock-reviewer   |
      | mock-researcher |
    When the Factory Operator installs "mock-reviewer" locally
    Then the skill is written to the target repository's skill directory
    When the Factory Operator installs "mock-researcher" globally
    Then the skill is written to the operator's global skill directory
    And an unknown skill is rejected without writing files

  Scenario: Resolve local and global configuration
    Given the Factory Operator initializes global configuration
    Then configuration is written to the operator's global configuration directory
    When the Factory Operator initializes local configuration
    Then configuration is written to the target repository
    And local values override global values
    And unspecified values retain global or built-in defaults
    And "laf config show" identifies each resolved value's source
