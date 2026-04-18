use super::quote_identifier;

#[test]
fn quote_identifier_escapes_double_quotes() {
    assert_eq!(quote_identifier("koduck_memory"), "\"koduck_memory\"");
    assert_eq!(quote_identifier("memory\"prod"), "\"memory\"\"prod\"");
}
