import os

import i18n

# set translation file directory
i18n.load_path.append(os.path.join(os.path.dirname(__file__), "translations"))

# set default language
i18n.set("fallback", "en")

# supported languages list
SUPPORTED_LANGUAGES = ["en", "zh"]


def get_translation(key: str, locale: str = "en", **kwargs) -> str:
    """
    get translation text

    Args:
        key: translation key
        locale: language code
        **kwargs: format parameters

    Returns:
        str: translated text
    """
    return i18n.t(key, locale=locale, **kwargs)
