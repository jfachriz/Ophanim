cmake_minimum_required(VERSION 3.22)
project(Ophanim VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_compile_options(-Wno-deprecated-declarations -Wno-unguarded-availability-new)

# JUCE 8 Module inclusion
if (NOT TARGET JUCE)
    if (EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../juce_sdk/CMakeLists.txt")
        add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/../juce_sdk" JUCE)
    else()
        include(FetchContent)
        FetchContent_Declare(
            JUCE
            GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
            GIT_TAG        8.0.4
            GIT_SHALLOW    TRUE
        )
        FetchContent_MakeAvailable(JUCE)
    endif()
endif()



# Plugin Target Configuration
juce_add_plugin(Ophanim
    COMPANY_NAME "Archangel DSP"
    BUNDLE_ID "com.ArchangelDSP.Ophanim"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD TRUE
    PLUGIN_MANUFACTURER_CODE ADSP
    PLUGIN_CODE Opha
    FORMATS VST3 AU CLAP
    PRODUCT_NAME "Ophanim"
)


# Source Files
target_sources(Ophanim
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

# Target Link Libraries (JUCE 8 Webview & DSP)
target_link_libraries(Ophanim
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

juce_generate_juce_header(Ophanim)
