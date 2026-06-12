use thiserror::Error;

const SERVICE_NAME: &str = "com.ebube.fiber-studio";
const PASSWORD_ACCOUNT: &str = "fnn-wallet-password";

#[derive(Debug, Error)]
pub enum KeychainError {
    #[error("failed to access OS keychain: {0}")]
    Access(#[from] keyring::Error),
}

pub fn set_wallet_password(password: &str) -> Result<(), KeychainError> {
    let entry = keyring::Entry::new(SERVICE_NAME, PASSWORD_ACCOUNT)?;
    entry.set_password(password)?;
    Ok(())
}

pub fn get_wallet_password() -> Result<String, KeychainError> {
    let entry = keyring::Entry::new(SERVICE_NAME, PASSWORD_ACCOUNT)?;
    Ok(entry.get_password()?)
}
