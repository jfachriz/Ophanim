#include "PluginProcessor.h"
#include "PluginEditor.h"

OphanimAudioProcessor::OphanimAudioProcessor()
#ifndef JucePlugin_PreferredChannelConfigurations
     : AudioProcessor (BusesProperties()
                     #if ! JucePlugin_IsMidiEffect
                      #if JucePlugin_IsSynth
                       .withOutput ("Output", juce::AudioChannelSet::stereo(), true)
                      #else
                       .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                       .withOutput ("Output", juce::AudioChannelSet::stereo(), true)
                      #endif
                     #endif
                       ),
       apvts (*this, nullptr, "Parameters", createParameterLayout())
#endif
{
}

OphanimAudioProcessor::~OphanimAudioProcessor()
{
}

juce::AudioProcessorValueTreeState::ParameterLayout OphanimAudioProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { "decay", 1 }, "Decay", 
        juce::NormalisableRange<float>(0.0f, 100.0f, 0.1f), 60.0f));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { "preDelay", 1 }, "Pre-Delay", 
        juce::NormalisableRange<float>(0.0f, 250.0f, 1.0f), 30.0f));

    params.push_back(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID { "sync", 1 }, "Sync", false));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { "mix", 1 }, "Mix", 
        juce::NormalisableRange<float>(0.0f, 100.0f, 0.1f), 50.0f));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { "width", 1 }, "Width", 
        juce::NormalisableRange<float>(0.0f, 100.0f, 0.1f), 80.0f));

    params.push_back(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID { "power", 1 }, "Power", true));

    return { params.begin(), params.end() };
}

void OphanimAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = static_cast<juce::uint32>(samplesPerBlock);
    spec.numChannels = static_cast<juce::uint32>(getTotalNumOutputChannels());

    reverbModule.prepare(spec);
    preDelayLine.prepare(spec);
}

void OphanimAudioProcessor::releaseResources()
{
}

bool OphanimAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return true;
}

void OphanimAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    const bool powerOn = *apvts.getRawParameterValue("power") > 0.5f;
    if (!powerOn) return; // Bypass mode

    const float decayVal = *apvts.getRawParameterValue("decay");
    const float preDelayMs = *apvts.getRawParameterValue("preDelay");
    const float mixVal = *apvts.getRawParameterValue("mix") / 100.0f;
    const float widthVal = *apvts.getRawParameterValue("width") / 100.0f;

    // Update Reverb DSP parameters
    reverbParams.roomSize = juce::jlimit(0.1f, 0.98f, decayVal / 100.0f);
    reverbParams.damping = 0.4f;
    reverbParams.wetLevel = mixVal;
    reverbParams.dryLevel = 1.0f - mixVal;
    reverbParams.width = widthVal;
    reverbModule.setParameters(reverbParams);

    // Apply pre-delay line
    const float delaySamples = static_cast<float>((preDelayMs / 1000.0) * getSampleRate());
    preDelayLine.setDelay(delaySamples);

    juce::dsp::AudioBlock<float> block (buffer);
    juce::dsp::ProcessContextReplacing<float> context (block);
    reverbModule.process(context);
}

juce::AudioProcessorEditor* OphanimAudioProcessor::createEditor()
{
    return new OphanimAudioProcessorEditor (*this);
}

void OphanimAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml (state.createXml());
    copyXmlToBinary (*xml, destData);
}

void OphanimAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState.get() != nullptr)
        if (xmlState->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xmlState));
}

// JUCE Plugin Creation Entrypoint
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new OphanimAudioProcessor();
}
